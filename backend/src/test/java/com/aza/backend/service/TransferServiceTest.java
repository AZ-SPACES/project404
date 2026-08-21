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
    @MockitoBean SystemSettingService systemSettingService;
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
        // The production default. Below it a HIGH-anomaly store payment still completes
        // so the till keeps moving; above it the compliance hold applies as for P2P.
        when(systemSettingService.merchantPosReviewCeilingGhs())
                .thenReturn(new BigDecimal("500.00"));
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
        // Both wallets are locked together before the limit re-check, so the recipient's
        // wallet must resolve even though this transfer is about to be rejected.
        when(walletRepository.findByUserIdForUpdate(recipientId))
                .thenReturn(Optional.of(Wallet.builder().userId(recipientId)
                        .balance(BigDecimal.ZERO).currency("GHS").frozen(false).build()));
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
        when(transactionRepository.getTotalSentToday(eq(senderId), any(), any(), any()))
                .thenReturn(BigDecimal.ZERO);
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

    @Test
    void executeSingleBulkItem_appliesMdr_forMerchantRecipient() {
        User sender = verifiedActiveUser();
        Wallet senderWallet = walletWithBalance("60000.00");
        UUID merchantId = UUID.randomUUID();
        Merchant merchant = Merchant.builder()
                .id(merchantId).businessName("Store").businessHandle("store")
                .status(Merchant.MerchantStatus.ACTIVE).userId(UUID.randomUUID())
                .feeRateBps(100) // 1% MDR
                .balance(new BigDecimal("0.00")).totalVolume(new BigDecimal("0.00")).build();

        when(userRepository.findByEmailOrPhoneNumber("store", "store")).thenReturn(Optional.empty());
        when(userRepository.findByUsername("store")).thenReturn(Optional.empty());
        when(merchantRepository.findByBusinessHandle("store")).thenReturn(Optional.of(merchant));
        when(merchantRepository.findByIdForUpdate(merchantId)).thenReturn(Optional.of(merchant));
        when(merchantRepository.findById(merchantId)).thenReturn(Optional.of(merchant));
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.of(senderWallet));
        when(transactionRepository.getTotalSentToday(eq(senderId), any(), any(), any()))
                .thenReturn(BigDecimal.ZERO);
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(inv -> {
            Transaction t = inv.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            return t;
        });

        transferService.executeSingleBulkItem(sender, "store", new BigDecimal("1000.00"), "supplier");

        assertEquals(new BigDecimal("59000.00"), senderWallet.getBalance());  // 60000 - 1000 (no consumer fee)
        assertEquals(new BigDecimal("990.00"), merchant.getBalance());        // 1000 - 1% MDR
        assertEquals(new BigDecimal("1000.00"), merchant.getTotalVolume());
    }

    // ── HIGH-anomaly merchant payments ────────────────────────────────────────
    // A queue at a till cannot wait on a human reviewer, so small store payments keep
    // completing even when the risk engine flags them. That exemption is capped: above
    // the point-of-sale ceiling the compliance hold wins, or the store rail would be
    // the one way out of Aza with no review on it.

    @Test
    void confirmTransfer_highAnomalyMerchantPayment_belowCeiling_completes() {
        User sender = verifiedActiveUser();
        Merchant merchant = posMerchant();
        Transaction tx = highAnomalyMerchantTx(merchant.getId(), "200.00");
        Wallet senderWallet = walletWithBalance("60000.00");

        stubMerchantConfirm(tx, merchant, senderWallet);

        transferService.confirmTransfer(sender, tx.getId(), "1234");

        assertEquals(Transaction.TransactionStatus.COMPLETED, tx.getStatus());
        assertEquals(new BigDecimal("198.00"), merchant.getBalance()); // 200 - 1% MDR
    }

    @Test
    void confirmTransfer_highAnomalyMerchantPayment_aboveCeiling_heldForReview() {
        User sender = verifiedActiveUser();
        Merchant merchant = posMerchant();
        // Above the GHS 500 default ceiling — no longer a till purchase in any real sense.
        Transaction tx = highAnomalyMerchantTx(merchant.getId(), "5000.00");
        Wallet senderWallet = walletWithBalance("60000.00");

        stubMerchantConfirm(tx, merchant, senderWallet);

        transferService.confirmTransfer(sender, tx.getId(), "1234");

        assertEquals(Transaction.TransactionStatus.HELD_FOR_REVIEW, tx.getStatus());
        assertEquals(new BigDecimal("0.00"), merchant.getBalance()); // nothing moved
        assertEquals(new BigDecimal("60000.00"), senderWallet.getBalance());
    }

    @Test
    void confirmTransfer_highAnomalyP2p_isStillHeldAtAnyAmount() {
        User sender = verifiedActiveUser();
        Transaction tx = Transaction.builder()
                .id(UUID.randomUUID()).senderId(senderId).recipientId(recipientId)
                .amount(new BigDecimal("50.00"))
                .status(Transaction.TransactionStatus.PENDING)
                .type(Transaction.TransactionType.TRANSFER)
                .recipientType(Transaction.RecipientType.USER)
                .anomalyRiskLevel("HIGH")
                .build();
        Wallet senderWallet = walletWithBalance("60000.00");

        when(transactionRepository.findById(tx.getId())).thenReturn(Optional.of(tx));
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.of(senderWallet));
        // Both wallets are now locked together, up front, in canonical order — so the
        // recipient's wallet has to exist even on paths that never move money.
        when(walletRepository.findByUserIdForUpdate(recipientId))
                .thenReturn(Optional.of(Wallet.builder().userId(recipientId)
                        .balance(BigDecimal.ZERO).currency("GHS").frozen(false).build()));
        when(userRepository.findById(recipientId)).thenReturn(Optional.empty());
        when(transactionRepository.getTotalSentToday(eq(senderId), any(), any(), any()))
                .thenReturn(BigDecimal.ZERO);

        transferService.confirmTransfer(sender, tx.getId(), "1234");

        assertEquals(Transaction.TransactionStatus.HELD_FOR_REVIEW, tx.getStatus());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Merchant posMerchant() {
        return Merchant.builder()
                .id(UUID.randomUUID()).businessName("Store").businessHandle("store")
                .status(Merchant.MerchantStatus.ACTIVE).userId(UUID.randomUUID())
                .feeRateBps(100) // 1% MDR
                .balance(new BigDecimal("0.00")).totalVolume(new BigDecimal("0.00"))
                .build();
    }

    private Transaction highAnomalyMerchantTx(UUID merchantId, String amount) {
        return Transaction.builder()
                .id(UUID.randomUUID()).senderId(senderId).recipientId(merchantId)
                .amount(new BigDecimal(amount))
                .status(Transaction.TransactionStatus.PENDING)
                .type(Transaction.TransactionType.MERCHANT_PAYMENT)
                .recipientType(Transaction.RecipientType.MERCHANT)
                .anomalyRiskLevel("HIGH")
                .build();
    }

    private void stubMerchantConfirm(Transaction tx, Merchant merchant, Wallet senderWallet) {
        when(transactionRepository.findById(tx.getId())).thenReturn(Optional.of(tx));
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.of(senderWallet));
        when(merchantRepository.findByIdForUpdate(merchant.getId())).thenReturn(Optional.of(merchant));
        when(merchantRepository.findById(merchant.getId())).thenReturn(Optional.of(merchant));
        when(userRepository.findById(merchant.getId())).thenReturn(Optional.empty());
        when(transactionRepository.getTotalSentToday(eq(senderId), any(), any(), any()))
                .thenReturn(BigDecimal.ZERO);
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(inv -> inv.getArgument(0));
    }

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

    // ── requestMoney idempotency ownership guard ──────────────────────────────
    // Idempotency keys are globally unique across the transactions table, so replaying
    // a key belonging to someone else's request must throw rather than hand back that
    // transaction's amount, note, status and counterparty.

    @Test
    void requestMoney_replayOfForeignKey_throwsInsteadOfLeaking() {
        User requester = verifiedActiveUser();
        User fromUser = User.builder().id(recipientId).status(User.AccountStatus.ACTIVE).build();

        Transaction foreign = Transaction.builder()
                .id(UUID.randomUUID())
                .senderId(UUID.randomUUID())      // unrelated parties
                .recipientId(UUID.randomUUID())
                .amount(new BigDecimal("500.00"))
                .note("someone else's private note")
                .type(Transaction.TransactionType.REQUEST)
                .status(Transaction.TransactionStatus.PENDING)
                .idempotencyKey("req-key-1")
                .build();

        when(userRepository.findByEmailOrPhoneNumber("bob@example.com", "bob@example.com"))
                .thenReturn(Optional.of(fromUser));
        when(transactionRepository.findByIdempotencyKey("req-key-1")).thenReturn(Optional.of(foreign));

        AppException ex = assertThrows(AppException.class,
                () -> transferService.requestMoney(requester, moneyRequest("50.00", "req-key-1")));
        assertTrue(ex.getMessage().toLowerCase().contains("idempotency"));
        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    @Test
    void requestMoney_replayOfOwnKey_returnsExisting() {
        User requester = verifiedActiveUser();
        User fromUser = User.builder().id(recipientId).firstName("Bob")
                .status(User.AccountStatus.ACTIVE).build();

        Transaction own = Transaction.builder()
                .id(UUID.randomUUID())
                .senderId(recipientId)            // money requested FROM bob
                .recipientId(senderId)            // TO the requester
                .amount(new BigDecimal("50.00"))
                .type(Transaction.TransactionType.REQUEST)
                .status(Transaction.TransactionStatus.PENDING)
                .idempotencyKey("req-key-2")
                .build();

        when(userRepository.findByEmailOrPhoneNumber("bob@example.com", "bob@example.com"))
                .thenReturn(Optional.of(fromUser));
        when(transactionRepository.findByIdempotencyKey("req-key-2")).thenReturn(Optional.of(own));

        TransferResponse res = transferService.requestMoney(requester, moneyRequest("50.00", "req-key-2"));

        assertEquals(own.getId().toString(), res.getId());
        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    private com.aza.backend.dto.transfer.MoneyRequestDto moneyRequest(String amount, String key) {
        com.aza.backend.dto.transfer.MoneyRequestDto req = new com.aza.backend.dto.transfer.MoneyRequestDto();
        req.setFromIdentifier("bob@example.com");
        req.setAmount(new BigDecimal(amount));
        req.setIdempotencyKey(key);
        return req;
    }
}
