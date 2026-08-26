package com.aza.backend.service;

import com.aza.backend.entity.RecurringTransfer;
import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.User;
import com.aza.backend.entity.Wallet;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.RecurringTransferRepository;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.WalletRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * A standing order is a transfer the payer set up earlier, not a transfer exempt from the
 * rules. It used to skip all three of them — it drained a frozen wallet, ignored the KYC
 * tier cap, and moved money free while every other P2P path charged.
 *
 * <p>These tests are only possible because the execution moved onto its own bean. While it
 * was a {@code private @Transactional} method invoked from inside its own class, it was
 * both untestable and — more seriously — running with no transaction at all.
 */
class RecurringTransferExecutorTest {

    private final RecurringTransferRepository recurringTransferRepository = mock(RecurringTransferRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final WalletRepository walletRepository = mock(WalletRepository.class);
    private final TransactionRepository transactionRepository = mock(TransactionRepository.class);
    private final AnomalyDetectionService anomalyDetectionService = mock(AnomalyDetectionService.class);
    private final RiskEngineService riskEngineService = mock(RiskEngineService.class);
    private final FeeCalculationService feeCalculationService = mock(FeeCalculationService.class);

    private final WalletLocker walletLocker = new WalletLocker(walletRepository);
    private final WalletLedger walletLedger =
            new WalletLedger(walletRepository, walletLocker, transactionRepository);

    private final RecurringTransferExecutor executor = new RecurringTransferExecutor(
            recurringTransferRepository, userRepository, walletRepository, walletLedger,
            transactionRepository, anomalyDetectionService, riskEngineService,
            new LimitGuard(), feeCalculationService);

    private final UUID senderId = UUID.randomUUID();
    private final UUID recipientId = UUID.randomUUID();

    private Wallet senderWallet;
    private Wallet recipientWallet;

    @BeforeEach
    void setUp() {
        senderWallet = wallet(senderId, "1000.00", false);
        recipientWallet = wallet(recipientId, "0.00", false);

        when(walletRepository.save(any(Wallet.class))).thenAnswer(i -> i.getArgument(0));
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(i -> i.getArgument(0));
        when(recurringTransferRepository.save(any(RecurringTransfer.class))).thenAnswer(i -> i.getArgument(0));
        when(anomalyDetectionService.score(any(), any(), any(), any()))
                .thenReturn(new AnomalyDetectionService.Result(0.0, "LOW", null));
        when(feeCalculationService.quote(eq("P2P"), any(), any()))
                .thenReturn(new FeeCalculationService.FeeQuote(BigDecimal.ZERO, null, true));
    }

    private static Wallet wallet(UUID userId, String balance, boolean frozen) {
        return Wallet.builder().id(UUID.randomUUID()).userId(userId)
                .type(Wallet.WalletType.PERSONAL).balance(new BigDecimal(balance))
                .currency("GHS").frozen(frozen).build();
    }

    private User sender() {
        return User.builder().id(senderId).status(User.AccountStatus.ACTIVE)
                .kycStatus(User.KycStatus.VERIFIED).build();
    }

    private RecurringTransfer standingOrder(String amount) {
        return RecurringTransfer.builder()
                .id(UUID.randomUUID())
                .userId(senderId)
                .recipientIdentifier("kofi")
                .amount(new BigDecimal(amount))
                .frequency(RecurringTransfer.Frequency.MONTHLY)
                .status(RecurringTransfer.Status.ACTIVE)
                .nextRunAt(LocalDateTime.now())
                .totalRuns(0)
                .successfulRuns(0)
                .build();
    }

    private void wireHappyPath() {
        User recipient = User.builder().id(recipientId).status(User.AccountStatus.ACTIVE).build();
        when(userRepository.findByEmailIgnoreCaseOrUsername("kofi", "kofi")).thenReturn(Optional.of(recipient));
        when(userRepository.findById(senderId)).thenReturn(Optional.of(sender()));
        when(walletRepository.findByUserId(senderId)).thenReturn(Optional.of(senderWallet));
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.of(senderWallet));
        when(walletRepository.findByUserIdForUpdate(recipientId)).thenReturn(Optional.of(recipientWallet));
    }

    @Test
    void movesTheMoneyAndAdvancesTheSchedule() {
        wireHappyPath();
        RecurringTransfer rt = standingOrder("100.00");

        executor.execute(rt);

        assertEquals(0, new BigDecimal("900.00").compareTo(senderWallet.getBalance()));
        assertEquals(0, new BigDecimal("100.00").compareTo(recipientWallet.getBalance()));
        assertEquals(1, rt.getSuccessfulRuns());
        assertNull(rt.getLastFailureReason());
    }

    @Test
    void refusesToDrainAFrozenWallet() {
        wireHappyPath();
        senderWallet.setFrozen(true);

        AppException e = assertThrows(AppException.class, () -> executor.execute(standingOrder("100.00")));

        assertEquals("WALLET_FROZEN", e.getCode());
        assertEquals(0, new BigDecimal("1000.00").compareTo(senderWallet.getBalance()), "nothing left the wallet");
        verify(walletRepository, never()).save(any(Wallet.class));
    }

    @Test
    void appliesThePayersTierCap() {
        wireHappyPath();
        // A payer with no tier set defaults to TIER_1, whose single-transaction cap is
        // GHS 1,000. The wallet is funded well past the amount, so the only thing that can
        // reject this is the cap itself.
        senderWallet.setBalance(new BigDecimal("50000.00"));

        AppException e = assertThrows(AppException.class, () -> executor.execute(standingOrder("1500.00")));

        assertEquals("LIMIT_EXCEEDED", e.getCode());
        assertEquals(0, new BigDecimal("50000.00").compareTo(senderWallet.getBalance()), "nothing moved");
        verify(walletRepository, never()).save(any(Wallet.class));
    }

    @Test
    void chargesTheSameP2PFeeAsAManualTransfer() {
        wireHappyPath();
        when(feeCalculationService.quote(eq("P2P"), any(), any()))
                .thenReturn(new FeeCalculationService.FeeQuote(new BigDecimal("0.50"), null, false));

        RecurringTransfer rt = standingOrder("100.00");
        executor.execute(rt);

        // Payer pays amount + fee; recipient receives the amount. The fee leaves circulation.
        assertEquals(0, new BigDecimal("899.50").compareTo(senderWallet.getBalance()));
        assertEquals(0, new BigDecimal("100.00").compareTo(recipientWallet.getBalance()));
        verify(feeCalculationService).recordMonthlyUsage(eq("P2P"), eq(new BigDecimal("100.00")), eq(senderId));
    }

    @Test
    void recordsTheFeeOnTheTransactionRow() {
        wireHappyPath();
        when(feeCalculationService.quote(eq("P2P"), any(), any()))
                .thenReturn(new FeeCalculationService.FeeQuote(new BigDecimal("0.50"), null, false));

        executor.execute(standingOrder("100.00"));

        var captor = org.mockito.ArgumentCaptor.forClass(Transaction.class);
        verify(transactionRepository).save(captor.capture());
        assertEquals(0, new BigDecimal("0.50").compareTo(captor.getValue().getFeeAmount()));
    }

    @Test
    void insufficientFundsForAmountPlusFee_movesNothing() {
        wireHappyPath();
        senderWallet.setBalance(new BigDecimal("100.00"));
        when(feeCalculationService.quote(eq("P2P"), any(), any()))
                .thenReturn(new FeeCalculationService.FeeQuote(new BigDecimal("0.50"), null, false));

        AppException e = assertThrows(AppException.class, () -> executor.execute(standingOrder("100.00")));

        assertEquals("INSUFFICIENT_FUNDS", e.getCode());
        assertEquals(0, new BigDecimal("100.00").compareTo(senderWallet.getBalance()));
        assertEquals(0, BigDecimal.ZERO.compareTo(recipientWallet.getBalance()));
    }

    @Test
    void inactiveRecipientIsRejectedBeforeAnyMoneyMoves() {
        when(userRepository.findByEmailIgnoreCaseOrUsername("kofi", "kofi"))
                .thenReturn(Optional.of(User.builder().id(recipientId)
                        .status(User.AccountStatus.SUSPENDED).build()));

        AppException e = assertThrows(AppException.class, () -> executor.execute(standingOrder("100.00")));

        assertEquals("RECIPIENT_UNAVAILABLE", e.getCode());
        verify(walletRepository, never()).save(any(Wallet.class));
    }

    @Test
    void locksBothWalletsRatherThanReadingThem() {
        wireHappyPath();

        executor.execute(standingOrder("100.00"));

        verify(walletRepository).findByUserIdForUpdate(senderId);
        verify(walletRepository).findByUserIdForUpdate(recipientId);
    }
}
