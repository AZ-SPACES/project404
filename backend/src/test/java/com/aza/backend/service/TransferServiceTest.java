package com.aza.backend.service;

import com.aza.backend.dto.transfer.TransferRequest;
import com.aza.backend.dto.transfer.TransferResponse;
import com.aza.backend.dto.transfer.WalletResponse;
import com.aza.backend.entity.*;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.*;
import com.aza.backend.util.EmailService;
import com.aza.backend.util.RateLimitService;
import com.aza.backend.util.SmsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class TransferServiceTest {

    @Autowired TransferService transferService;

    @MockitoBean TransactionRepository transactionRepository;
    @MockitoBean WalletRepository walletRepository;
    @MockitoBean UserRepository userRepository;
    @MockitoBean UserService userService;
    @MockitoBean MerchantRepository merchantRepository;
    @MockitoBean CheckoutSessionRepository sessionRepository;
    @MockitoBean CheckoutService checkoutService;
    @MockitoBean RateLimitService rateLimitService;
    @MockitoBean WebSocketPublisher webSocketPublisher;
    @MockitoBean NotificationService notificationService;
    @MockitoBean EmailService emailService;
    @MockitoBean SmsService smsService;
    @MockitoBean MerchantNotificationPreferenceRepository merchantNotificationPrefRepository;
    @MockitoBean AnomalyDetectionService anomalyDetectionService;
    @MockitoBean AuditService auditService;
    @MockitoBean RiskEngineService riskEngineService;
    @MockitoBean FeeCalculationService feeCalculationService;
    @MockitoBean StringRedisTemplate stringRedisTemplate;
    @MockitoBean RedisMessageListenerContainer redisMessageListenerContainer;

    private final UUID senderId    = UUID.randomUUID();
    private final UUID recipientId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        // Limits now come from LimitGuard (custom override ?? KYC-tier cap). Test users carry
        // custom 10000/50000 overrides via verifiedActiveUser(), preserving prior expectations.
        when(anomalyDetectionService.score(any(), any(), any(), any()))
                .thenReturn(new AnomalyDetectionService.Result(0.0, "LOW", null));
        // Default: no fee, so existing transfer assertions stay pre-fee. Fee-charging
        // behaviour is covered explicitly in confirmTransfer_chargesP2pFee_*.
        when(feeCalculationService.quote(any(), any(), any()))
                .thenReturn(new FeeCalculationService.FeeQuote(BigDecimal.ZERO, null, true));
    }

    // ── getBalance ────────────────────────────────────────────────────────────

    @Test
    void getBalance_walletNotFound_throws() {
        when(walletRepository.findByUserId(senderId)).thenReturn(Optional.empty());

        assertThrows(AppException.class, () -> transferService.getBalance(senderId));
    }

    @Test
    void getBalance_success_returnsBalanceAndCurrency() {
        Wallet wallet = Wallet.builder()
                .userId(senderId).balance(new BigDecimal("500.00")).currency("GHS").build();
        when(walletRepository.findByUserId(senderId)).thenReturn(Optional.of(wallet));

        WalletResponse response = transferService.getBalance(senderId);

        assertEquals(new BigDecimal("500.00"), response.getBalance());
        assertEquals("GHS", response.getCurrency());
    }

    // ── initiateTransfer ──────────────────────────────────────────────────────

    @Test
    void initiateTransfer_inactiveAccount_throws() {
        User sender = User.builder().id(senderId)
                .status(User.AccountStatus.SUSPENDED).kycStatus(User.KycStatus.VERIFIED).build();
        when(transactionRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());

        assertThrows(AppException.class,
                () -> transferService.initiateTransfer(sender, transferRequest("50.00")));
    }

    @Test
    void initiateTransfer_kycNotVerified_throws() {
        User sender = User.builder().id(senderId)
                .status(User.AccountStatus.ACTIVE).kycStatus(User.KycStatus.PENDING).build();
        when(transactionRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());

        assertThrows(AppException.class,
                () -> transferService.initiateTransfer(sender, transferRequest("50.00")));
    }

    @Test
    void initiateTransfer_exceedsSingleLimit_throws() {
        when(transactionRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());

        assertThrows(AppException.class,
                () -> transferService.initiateTransfer(verifiedActiveUser(), transferRequest("20000.00")));
    }

    @Test
    void initiateTransfer_transferToSelf_throws() {
        User recipient = User.builder().id(senderId).status(User.AccountStatus.ACTIVE).build();
        when(transactionRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
        when(transactionRepository.getTotalSentToday(any(), any(), any(), any())).thenReturn(BigDecimal.ZERO);
        when(userRepository.findByEmailOrPhoneNumber(anyString(), anyString())).thenReturn(Optional.of(recipient));
        when(walletRepository.findByUserId(senderId)).thenReturn(Optional.of(walletWithBalance("1000.00")));

        assertThrows(AppException.class,
                () -> transferService.initiateTransfer(verifiedActiveUser(), transferRequest("100.00")));
    }

    @Test
    void initiateTransfer_frozenWallet_throws() {
        User recipient = User.builder().id(recipientId).status(User.AccountStatus.ACTIVE).build();
        Wallet frozenWallet = Wallet.builder().userId(senderId)
                .balance(new BigDecimal("1000.00")).frozen(true).build();
        when(transactionRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
        when(transactionRepository.getTotalSentToday(any(), any(), any(), any())).thenReturn(BigDecimal.ZERO);
        when(userRepository.findByEmailOrPhoneNumber(anyString(), anyString())).thenReturn(Optional.of(recipient));
        when(merchantRepository.findByBusinessHandle(anyString())).thenReturn(Optional.empty());
        when(walletRepository.findByUserId(senderId)).thenReturn(Optional.of(frozenWallet));

        AppException ex = assertThrows(AppException.class,
                () -> transferService.initiateTransfer(verifiedActiveUser(), transferRequest("100.00")));

        assertEquals("WALLET_FROZEN", ex.getCode());
    }

    @Test
    void initiateTransfer_insufficientBalance_throws() {
        User recipient = User.builder().id(recipientId).status(User.AccountStatus.ACTIVE).build();
        when(transactionRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
        when(transactionRepository.getTotalSentToday(any(), any(), any(), any())).thenReturn(BigDecimal.ZERO);
        when(userRepository.findByEmailOrPhoneNumber(anyString(), anyString())).thenReturn(Optional.of(recipient));
        when(merchantRepository.findByBusinessHandle(anyString())).thenReturn(Optional.empty());
        when(walletRepository.findByUserId(senderId)).thenReturn(Optional.of(walletWithBalance("10.00")));

        assertThrows(AppException.class,
                () -> transferService.initiateTransfer(verifiedActiveUser(), transferRequest("500.00")));
    }

    @Test
    void initiateTransfer_idempotentKey_returnsExistingTransaction() {
        User recipient = User.builder().id(recipientId).firstName("Bob").lastName("Jones").build();
        Transaction existing = Transaction.builder()
                .id(UUID.randomUUID()).senderId(senderId).recipientId(recipientId)
                .amount(new BigDecimal("100.00"))
                .status(Transaction.TransactionStatus.PENDING)
                .type(Transaction.TransactionType.TRANSFER)
                .build();
        when(transactionRepository.findByIdempotencyKey("idem-key")).thenReturn(Optional.of(existing));
        when(userRepository.findById(recipientId)).thenReturn(Optional.of(recipient));
        when(merchantRepository.findById(any())).thenReturn(Optional.empty());

        TransferResponse response = transferService.initiateTransfer(verifiedActiveUser(), transferRequest("100.00"));

        assertEquals("PENDING", response.getStatus());
        verify(walletRepository, never()).findByUserId(any());
    }

    // ── cancelTransfer ────────────────────────────────────────────────────────

    @Test
    void cancelTransfer_transactionNotFound_throws() {
        when(transactionRepository.findById(any())).thenReturn(Optional.empty());

        assertThrows(AppException.class,
                () -> transferService.cancelTransfer(verifiedActiveUser(), UUID.randomUUID()));
    }

    @Test
    void cancelTransfer_notOwner_throws() {
        UUID otherId = UUID.randomUUID();
        Transaction t = Transaction.builder()
                .id(UUID.randomUUID()).senderId(otherId).recipientId(recipientId)
                .status(Transaction.TransactionStatus.PENDING).build();
        when(transactionRepository.findById(t.getId())).thenReturn(Optional.of(t));

        assertThrows(AppException.class,
                () -> transferService.cancelTransfer(verifiedActiveUser(), t.getId()));
    }

    @Test
    void cancelTransfer_nonPendingTransaction_throws() {
        Transaction t = Transaction.builder()
                .id(UUID.randomUUID()).senderId(senderId).recipientId(recipientId)
                .status(Transaction.TransactionStatus.COMPLETED).build();
        when(transactionRepository.findById(t.getId())).thenReturn(Optional.of(t));

        assertThrows(AppException.class,
                () -> transferService.cancelTransfer(verifiedActiveUser(), t.getId()));
    }

    @Test
    void cancelTransfer_success_setsStatusCancelled() {
        Transaction t = Transaction.builder()
                .id(UUID.randomUUID()).senderId(senderId).recipientId(recipientId)
                .amount(new BigDecimal("100.00"))
                .status(Transaction.TransactionStatus.PENDING)
                .type(Transaction.TransactionType.TRANSFER)
                .build();
        User recipient = User.builder().id(recipientId).firstName("Bob").lastName("Jones").build();
        when(transactionRepository.findById(t.getId())).thenReturn(Optional.of(t));
        when(userRepository.findById(recipientId)).thenReturn(Optional.of(recipient));
        when(merchantRepository.findById(any())).thenReturn(Optional.empty());

        TransferResponse response = transferService.cancelTransfer(verifiedActiveUser(), t.getId());

        assertEquals("CANCELLED", response.getStatus());
        verify(transactionRepository).save(argThat(
                tx -> tx.getStatus() == Transaction.TransactionStatus.CANCELLED));
    }

    // ── freezeWallet / unfreezeWallet ─────────────────────────────────────────

    @Test
    void freezeWallet_setsFrozenTrue() {
        Wallet wallet = walletWithBalance("1000.00");
        when(walletRepository.findByUserId(senderId)).thenReturn(Optional.of(wallet));

        transferService.freezeWallet(senderId);

        assertTrue(wallet.getFrozen());
        verify(walletRepository).save(wallet);
    }

    @Test
    void unfreezeWallet_setsFrozenFalse() {
        Wallet wallet = Wallet.builder().userId(senderId)
                .balance(new BigDecimal("1000.00")).frozen(true).build();
        when(walletRepository.findByUserId(senderId)).thenReturn(Optional.of(wallet));

        transferService.unfreezeWallet(senderId);

        assertFalse(wallet.getFrozen());
        verify(walletRepository).save(wallet);
    }

    // ── confirmTransfer ───────────────────────────────────────────────────────

    @Test
    void confirmTransfer_dailyLimitExceededAtConfirmTime_throwsAndFailsTransaction() {
        // Simulates a race where two transfers were initiated concurrently and both
        // passed the initiation-time limit check; the second one to confirm is rejected.
        User sender = verifiedActiveUser();
        Transaction tx = Transaction.builder()
                .id(UUID.randomUUID()).senderId(senderId).recipientId(recipientId)
                .amount(new BigDecimal("1000.00"))
                .status(Transaction.TransactionStatus.PENDING)
                .type(Transaction.TransactionType.TRANSFER)
                .build();

        Wallet senderWallet = walletWithBalance("60000.00"); // plenty of balance
        when(transactionRepository.findById(tx.getId())).thenReturn(Optional.of(tx));
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.of(senderWallet));
        // Today's total already at 51000 (over the 50000 limit), including this tx
        when(transactionRepository.getTotalSentToday(eq(senderId), any(), any(), any()))
                .thenReturn(new BigDecimal("51000.00"));

        AppException ex = assertThrows(AppException.class,
                () -> transferService.confirmTransfer(sender, tx.getId(), "1234"));

        assertTrue(ex.getMessage().contains("Daily transfer limit"));
        verify(transactionRepository).save(argThat(t -> t.getStatus() == Transaction.TransactionStatus.FAILED));
    }

    @Test
    void confirmTransfer_chargesP2pFee_debitsAmountPlusFee() {
        User sender = verifiedActiveUser();
        Transaction tx = Transaction.builder()
                .id(UUID.randomUUID()).senderId(senderId).recipientId(recipientId)
                .amount(new BigDecimal("5000.00"))
                .status(Transaction.TransactionStatus.PENDING)
                .type(Transaction.TransactionType.TRANSFER)
                .build();

        Wallet senderWallet = walletWithBalance("60000.00");
        Wallet recipientWallet = Wallet.builder()
                .userId(recipientId).balance(new BigDecimal("0.00")).currency("GHS").frozen(false).build();
        User recipient = User.builder().id(recipientId).firstName("Bob").lastName("Jones")
                .email("bob@example.com").build();

        when(transactionRepository.findById(tx.getId())).thenReturn(Optional.of(tx));
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.of(senderWallet));
        when(walletRepository.findByUserIdForUpdate(recipientId)).thenReturn(Optional.of(recipientWallet));
        when(merchantRepository.findByIdForUpdate(recipientId)).thenReturn(Optional.empty());
        when(userRepository.findById(recipientId)).thenReturn(Optional.of(recipient));
        when(transactionRepository.getTotalSentToday(eq(senderId), any(), any(), any()))
                .thenReturn(BigDecimal.ZERO);
        // 0.5% of 5000 = 25, capped at the rule's GHS 10
        when(feeCalculationService.quote(eq("P2P"), eq(new BigDecimal("5000.00")), eq(senderId)))
                .thenReturn(new FeeCalculationService.FeeQuote(new BigDecimal("10.00"), UUID.randomUUID(), false));

        transferService.confirmTransfer(sender, tx.getId(), "1234");

        assertEquals(new BigDecimal("54990.00"), senderWallet.getBalance()); // 60000 - 5000 - 10 fee
        assertEquals(new BigDecimal("5000.00"), recipientWallet.getBalance()); // recipient gets amount only
        assertEquals(new BigDecimal("10.00"), tx.getFeeAmount());
        assertEquals(Transaction.TransactionStatus.COMPLETED, tx.getStatus());
        verify(feeCalculationService).recordMonthlyUsage("P2P", new BigDecimal("5000.00"), senderId);
    }

    @Test
    void acceptMoneyRequest_chargesP2pFee_debitsPayerAmountPlusFee() {
        User payer = verifiedActiveUser();
        // In a money request the payer is the sender; the requester is the recipient.
        Transaction tx = Transaction.builder()
                .id(UUID.randomUUID()).senderId(senderId).recipientId(recipientId)
                .amount(new BigDecimal("5000.00"))
                .status(Transaction.TransactionStatus.PENDING)
                .type(Transaction.TransactionType.REQUEST).isRequest(true)
                .build();

        Wallet payerWallet = walletWithBalance("60000.00");
        Wallet requesterWallet = Wallet.builder()
                .userId(recipientId).balance(new BigDecimal("0.00")).currency("GHS").frozen(false).build();
        User requester = User.builder().id(recipientId).firstName("Bob").lastName("Jones").build();

        when(transactionRepository.findById(tx.getId())).thenReturn(Optional.of(tx));
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.of(payerWallet));
        when(walletRepository.findByUserIdForUpdate(recipientId)).thenReturn(Optional.of(requesterWallet));
        when(userRepository.findById(recipientId)).thenReturn(Optional.of(requester));
        when(transactionRepository.getTotalSentToday(eq(senderId), any(), any(), any()))
                .thenReturn(BigDecimal.ZERO);
        when(feeCalculationService.quote(eq("P2P"), eq(new BigDecimal("5000.00")), eq(senderId)))
                .thenReturn(new FeeCalculationService.FeeQuote(new BigDecimal("10.00"), UUID.randomUUID(), false));

        transferService.acceptMoneyRequest(payer, tx.getId(), "1234");

        assertEquals(new BigDecimal("54990.00"), payerWallet.getBalance()); // 60000 - 5000 - 10 fee
        assertEquals(new BigDecimal("5000.00"), requesterWallet.getBalance());
        assertEquals(new BigDecimal("10.00"), tx.getFeeAmount());
        verify(feeCalculationService).recordMonthlyUsage("P2P", new BigDecimal("5000.00"), senderId);
    }

    @Test
    void executeSingleBulkItem_chargesP2pFee_forUserRecipient() {
        User sender = verifiedActiveUser();
        Wallet senderWallet = walletWithBalance("60000.00");
        Wallet recipientWallet = Wallet.builder()
                .userId(recipientId).balance(new BigDecimal("0.00")).currency("GHS").frozen(false).build();
        User recipient = User.builder().id(recipientId).firstName("Bob").lastName("Jones")
                .status(User.AccountStatus.ACTIVE).build();

        when(userRepository.findByEmailOrPhoneNumber("bob@example.com", "bob@example.com"))
                .thenReturn(Optional.of(recipient));
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.of(senderWallet));
        when(walletRepository.findByUserIdForUpdate(recipientId)).thenReturn(Optional.of(recipientWallet));
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(inv -> {
            Transaction t = inv.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            return t;
        });
        when(feeCalculationService.quote(eq("P2P"), eq(new BigDecimal("5000.00")), eq(senderId)))
                .thenReturn(new FeeCalculationService.FeeQuote(new BigDecimal("10.00"), UUID.randomUUID(), false));

        transferService.executeSingleBulkItem(sender, "bob@example.com", new BigDecimal("5000.00"), "payroll");

        assertEquals(new BigDecimal("54990.00"), senderWallet.getBalance()); // 60000 - 5000 - 10 fee
        assertEquals(new BigDecimal("5000.00"), recipientWallet.getBalance());
        verify(feeCalculationService).recordMonthlyUsage("P2P", new BigDecimal("5000.00"), senderId);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private User verifiedActiveUser() {
        return User.builder()
                .id(senderId).firstName("Alice").lastName("Smith")
                .email("alice@example.com")
                .status(User.AccountStatus.ACTIVE).kycStatus(User.KycStatus.VERIFIED)
                .customSingleTransactionLimitGhs(new BigDecimal("10000"))
                .customDailyLimitGhs(new BigDecimal("50000"))
                .build();
    }

    private Wallet walletWithBalance(String amount) {
        return Wallet.builder()
                .userId(senderId).balance(new BigDecimal(amount)).currency("GHS").frozen(false).build();
    }

    private TransferRequest transferRequest(String amount) {
        TransferRequest req = new TransferRequest();
        req.setRecipientIdentifier("bob@example.com");
        req.setAmount(new BigDecimal(amount));
        req.setIdempotencyKey("idem-key");
        return req;
    }
}
