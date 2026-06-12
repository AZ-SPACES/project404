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
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class TransferServiceTest {

    private TransferService transferService;

    @Mock private TransactionRepository transactionRepository;
    @Mock private WalletRepository walletRepository;
    @Mock private UserRepository userRepository;
    @Mock private UserService userService;
    @Mock private MerchantRepository merchantRepository;
    @Mock private CheckoutSessionRepository sessionRepository;
    @Mock private CheckoutService checkoutService;
    @Mock private RateLimitService rateLimitService;
    @Mock private WebSocketPublisher webSocketPublisher;
    @Mock private NotificationService notificationService;
    @Mock private EmailService emailService;
    @Mock private SmsService smsService;
    @Mock private MerchantNotificationPreferenceRepository merchantNotificationPrefRepository;
    @Mock private AnomalyDetectionService anomalyDetectionService;
    @Mock private AuditService auditService;
    @Mock private RiskEngineService riskEngineService;

    private final UUID senderId = UUID.randomUUID();
    private final UUID recipientId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        transferService = new TransferService(
                transactionRepository, walletRepository, userRepository, userService,
                merchantRepository, sessionRepository, checkoutService, rateLimitService,
                webSocketPublisher, notificationService, emailService, smsService,
                merchantNotificationPrefRepository, anomalyDetectionService, auditService,
                riskEngineService);

        ReflectionTestUtils.setField(transferService, "maxSingleAmount", new BigDecimal("10000"));
        ReflectionTestUtils.setField(transferService, "maxDailyAmount", new BigDecimal("50000"));

        when(anomalyDetectionService.score(any(), any(), any(), any()))
                .thenReturn(new AnomalyDetectionService.Result(0.0, "LOW", null));
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
                .userId(senderId)
                .balance(new BigDecimal("500.00"))
                .currency("GHS")
                .build();
        when(walletRepository.findByUserId(senderId)).thenReturn(Optional.of(wallet));

        WalletResponse response = transferService.getBalance(senderId);

        assertEquals(new BigDecimal("500.00"), response.getBalance());
        assertEquals("GHS", response.getCurrency());
    }

    // ── initiateTransfer ──────────────────────────────────────────────────────

    @Test
    void initiateTransfer_inactiveAccount_throws() {
        User sender = User.builder().id(senderId).status(User.AccountStatus.SUSPENDED)
                .kycStatus(User.KycStatus.VERIFIED).build();
        when(transactionRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());

        assertThrows(AppException.class,
                () -> transferService.initiateTransfer(sender, transferRequest("50.00")));
    }

    @Test
    void initiateTransfer_kycNotVerified_throws() {
        User sender = User.builder().id(senderId).status(User.AccountStatus.ACTIVE)
                .kycStatus(User.KycStatus.PENDING).build();
        when(transactionRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());

        assertThrows(AppException.class,
                () -> transferService.initiateTransfer(sender, transferRequest("50.00")));
    }

    @Test
    void initiateTransfer_exceedsSingleLimit_throws() {
        User sender = verifiedActiveUser();
        when(transactionRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());

        assertThrows(AppException.class,
                () -> transferService.initiateTransfer(sender, transferRequest("20000.00")));
    }

    @Test
    void initiateTransfer_transferToSelf_throws() {
        User sender = verifiedActiveUser();
        User recipient = User.builder().id(senderId).status(User.AccountStatus.ACTIVE).build();

        when(transactionRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
        when(transactionRepository.getTotalSentToday(any(), any(), any(), any())).thenReturn(BigDecimal.ZERO);
        when(userRepository.findByEmailOrPhoneNumber(anyString(), anyString())).thenReturn(Optional.of(recipient));
        when(walletRepository.findByUserId(senderId)).thenReturn(Optional.of(walletWithBalance("1000.00")));

        assertThrows(AppException.class,
                () -> transferService.initiateTransfer(sender, transferRequest("100.00")));
    }

    @Test
    void initiateTransfer_frozenWallet_throws() {
        User sender = verifiedActiveUser();
        User recipient = User.builder().id(recipientId).status(User.AccountStatus.ACTIVE).build();

        Wallet frozenWallet = Wallet.builder().userId(senderId)
                .balance(new BigDecimal("1000.00")).frozen(true).build();

        when(transactionRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
        when(transactionRepository.getTotalSentToday(any(), any(), any(), any())).thenReturn(BigDecimal.ZERO);
        when(userRepository.findByEmailOrPhoneNumber(anyString(), anyString())).thenReturn(Optional.of(recipient));
        when(merchantRepository.findByBusinessHandle(anyString())).thenReturn(Optional.empty());
        when(walletRepository.findByUserId(senderId)).thenReturn(Optional.of(frozenWallet));

        AppException ex = assertThrows(AppException.class,
                () -> transferService.initiateTransfer(sender, transferRequest("100.00")));

        assertEquals("WALLET_FROZEN", ex.getCode());
    }

    @Test
    void initiateTransfer_insufficientBalance_throws() {
        User sender = verifiedActiveUser();
        User recipient = User.builder().id(recipientId).status(User.AccountStatus.ACTIVE).build();

        when(transactionRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
        when(transactionRepository.getTotalSentToday(any(), any(), any(), any())).thenReturn(BigDecimal.ZERO);
        when(userRepository.findByEmailOrPhoneNumber(anyString(), anyString())).thenReturn(Optional.of(recipient));
        when(merchantRepository.findByBusinessHandle(anyString())).thenReturn(Optional.empty());
        when(walletRepository.findByUserId(senderId)).thenReturn(Optional.of(walletWithBalance("10.00")));

        assertThrows(AppException.class,
                () -> transferService.initiateTransfer(sender, transferRequest("500.00")));
    }

    @Test
    void initiateTransfer_idempotentKey_returnsExistingTransaction() {
        User sender = verifiedActiveUser();
        User recipient = User.builder().id(recipientId)
                .firstName("Bob").lastName("Jones").build();

        Transaction existing = Transaction.builder()
                .id(UUID.randomUUID())
                .senderId(senderId)
                .recipientId(recipientId)
                .amount(new BigDecimal("100.00"))
                .status(Transaction.TransactionStatus.PENDING)
                .type(Transaction.TransactionType.TRANSFER)
                .build();

        when(transactionRepository.findByIdempotencyKey("idem-key")).thenReturn(Optional.of(existing));
        when(userRepository.findById(recipientId)).thenReturn(Optional.of(recipient));
        when(merchantRepository.findById(any())).thenReturn(Optional.empty());

        TransferResponse response = transferService.initiateTransfer(sender, transferRequest("100.00"));

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
                .id(UUID.randomUUID())
                .senderId(otherId)
                .recipientId(recipientId)
                .status(Transaction.TransactionStatus.PENDING)
                .build();

        when(transactionRepository.findById(t.getId())).thenReturn(Optional.of(t));

        assertThrows(AppException.class,
                () -> transferService.cancelTransfer(verifiedActiveUser(), t.getId()));
    }

    @Test
    void cancelTransfer_nonPendingTransaction_throws() {
        Transaction t = Transaction.builder()
                .id(UUID.randomUUID())
                .senderId(senderId)
                .recipientId(recipientId)
                .status(Transaction.TransactionStatus.COMPLETED)
                .build();

        when(transactionRepository.findById(t.getId())).thenReturn(Optional.of(t));

        assertThrows(AppException.class,
                () -> transferService.cancelTransfer(verifiedActiveUser(), t.getId()));
    }

    @Test
    void cancelTransfer_success_setsStatusCancelled() {
        Transaction t = Transaction.builder()
                .id(UUID.randomUUID())
                .senderId(senderId)
                .recipientId(recipientId)
                .amount(new BigDecimal("100.00"))
                .status(Transaction.TransactionStatus.PENDING)
                .type(Transaction.TransactionType.TRANSFER)
                .build();
        User recipient = User.builder().id(recipientId)
                .firstName("Bob").lastName("Jones").build();

        when(transactionRepository.findById(t.getId())).thenReturn(Optional.of(t));
        when(userRepository.findById(recipientId)).thenReturn(Optional.of(recipient));
        when(merchantRepository.findById(any())).thenReturn(Optional.empty());

        TransferResponse response = transferService.cancelTransfer(verifiedActiveUser(), t.getId());

        assertEquals("CANCELLED", response.getStatus());
        verify(transactionRepository).save(argThat(tx ->
                tx.getStatus() == Transaction.TransactionStatus.CANCELLED));
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

    // ── Helpers ───────────────────────────────────────────────────────────────

    private User verifiedActiveUser() {
        return User.builder()
                .id(senderId)
                .firstName("Alice")
                .lastName("Smith")
                .email("alice@example.com")
                .status(User.AccountStatus.ACTIVE)
                .kycStatus(User.KycStatus.VERIFIED)
                .build();
    }

    private Wallet walletWithBalance(String amount) {
        return Wallet.builder()
                .userId(senderId)
                .balance(new BigDecimal(amount))
                .currency("GHS")
                .frozen(false)
                .build();
    }

    private TransferRequest transferRequest(String amount) {
        TransferRequest req = new TransferRequest();
        req.setRecipientIdentifier("bob@example.com");
        req.setAmount(new BigDecimal(amount));
        req.setIdempotencyKey("idem-key");
        return req;
    }
}
