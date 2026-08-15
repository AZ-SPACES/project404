package com.aza.backend.service;

import com.aza.backend.dto.bill.BillPaymentResponse;
import com.aza.backend.dto.bill.PayBillRequest;
import com.aza.backend.entity.*;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.*;
import com.aza.backend.service.biller.BillerProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Paying a bill is the one money path where the outcome is decided elsewhere. Most of
 * these tests are about the difference between "the biller said no" and "the biller said
 * nothing" — the first is a refund, the second is emphatically not one.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class BillPaymentServiceTest {

    @Autowired BillPaymentService service;

    @MockitoBean BillPaymentRepository billPaymentRepository;
    @MockitoBean BillerRepository billerRepository;
    @MockitoBean WalletRepository walletRepository;
    @MockitoBean UserRepository userRepository;
    @MockitoBean TransactionRepository transactionRepository;
    @MockitoBean NotificationService notificationService;
    @MockitoBean UserService userService;
    @MockitoBean BillerProvider provider;
    @MockitoBean StringRedisTemplate stringRedisTemplate;
    @MockitoBean RedisMessageListenerContainer redisMessageListenerContainer;

    private final UUID userId = UUID.randomUUID();
    private final UUID billerId = UUID.randomUUID();

    private final Map<UUID, BillPayment> payments = new HashMap<>();
    private final Map<UUID, Transaction> ledger = new HashMap<>();
    private Wallet wallet;

    @BeforeEach
    void setUp() {
        payments.clear();
        ledger.clear();
        wallet = wallet("500.00");

        when(billPaymentRepository.save(any(BillPayment.class))).thenAnswer(inv -> {
            BillPayment p = inv.getArgument(0);
            if (p.getId() == null) p.setId(UUID.randomUUID());
            payments.put(p.getId(), p);
            return p;
        });
        when(billPaymentRepository.findById(any()))
                .thenAnswer(inv -> Optional.ofNullable(payments.get(inv.getArgument(0))));
        when(billPaymentRepository.findByIdForUpdate(any()))
                .thenAnswer(inv -> Optional.ofNullable(payments.get(inv.getArgument(0))));
        when(billPaymentRepository.findByUserIdAndIdempotencyKey(any(), anyString()))
                .thenReturn(Optional.empty());

        when(transactionRepository.save(any(Transaction.class))).thenAnswer(inv -> {
            Transaction t = inv.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            ledger.put(t.getId(), t);
            return t;
        });
        when(transactionRepository.findById(any()))
                .thenAnswer(inv -> Optional.ofNullable(ledger.get(inv.getArgument(0))));
        when(transactionRepository.getTotalSentToday(any(), any(), any(), any())).thenReturn(BigDecimal.ZERO);

        when(billerRepository.findBySlug("ecg-prepaid")).thenReturn(Optional.of(biller()));
        when(billerRepository.findById(billerId)).thenReturn(Optional.of(biller()));

        when(walletRepository.findByUserIdForUpdate(userId)).thenReturn(Optional.of(wallet));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user()));
    }

    // ── The happy path ────────────────────────────────────────────────────────

    @Test
    @DisplayName("a paid bill debits once, completes the ledger row, and keeps the token")
    void successDebitsAndKeepsTheToken() {
        when(provider.pay(any(), any())).thenReturn(
                BillerProvider.PaymentResult.success("REF-1", "1234-5678-9012-3456-7890"));

        BillPaymentResponse response = service.pay(user(), request("100.00"));

        assertEquals(new BigDecimal("400.00"), wallet.getBalance());
        assertEquals("COMPLETED", response.getStatus());
        assertEquals("1234-5678-9012-3456-7890", response.getToken());
        assertEquals(1, ledger.size());
        assertEquals(Transaction.TransactionStatus.COMPLETED, ledger.values().iterator().next().getStatus());
        assertEquals(Transaction.TransactionType.BILL_PAY, ledger.values().iterator().next().getType());
    }

    @Test
    @DisplayName("the wallet is debited before the provider is ever called")
    void debitHappensBeforeTheProviderIsCalled() {
        // If the provider is reached with the money still in the wallet, a bill could be
        // paid that was never funded. Assert the ordering rather than trusting it.
        when(provider.pay(any(), any())).thenAnswer(inv -> {
            assertEquals(new BigDecimal("400.00"), wallet.getBalance(),
                    "provider was called before the debit committed");
            return BillerProvider.PaymentResult.success("REF-1", null);
        });

        service.pay(user(), request("100.00"));
        verify(provider).pay(any(), any());
    }

    // ── Refusal versus silence ────────────────────────────────────────────────

    @Test
    @DisplayName("a biller that refuses gets the customer their money back")
    void rejectedIsRefunded() {
        when(provider.pay(any(), any())).thenReturn(
                BillerProvider.PaymentResult.rejected("REF-2", "Meter not found"));

        BillPaymentResponse response = service.pay(user(), request("100.00"));

        assertEquals("REFUNDED", response.getStatus());
        assertEquals(new BigDecimal("500.00"), wallet.getBalance());
        assertEquals(Transaction.TransactionStatus.CANCELLED, ledger.values().iterator().next().getStatus());
    }

    @Test
    @DisplayName("a provider that throws cleanly never sent it, so the money comes back")
    void aCleanRefusalRefunds() {
        when(provider.pay(any(), any())).thenThrow(
                new AppException("BILLER_UNAVAILABLE", "Bills aren't available yet.",
                        org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE));

        assertThrows(AppException.class, () -> service.pay(user(), request("100.00")));

        // A customer must not be left short because a biller was down.
        assertEquals(new BigDecimal("500.00"), wallet.getBalance());
        assertEquals(BillPayment.Status.REFUNDED, payments.values().iterator().next().getStatus());
    }

    /**
     * The one that matters most. A timeout is not a refusal: the biller may well have
     * taken the money. Refunding here would pay the bill twice.
     */
    @Test
    @DisplayName("a provider that says nothing leaves the payment pending, never refunded")
    void silenceIsNotFailure() {
        when(provider.pay(any(), any())).thenThrow(new RuntimeException("read timed out"));

        BillPaymentResponse response = service.pay(user(), request("100.00"));

        assertEquals("PENDING", response.getStatus());
        assertEquals(new BigDecimal("400.00"), wallet.getBalance(), "silence must not trigger a refund");
        assertEquals(Transaction.TransactionStatus.PENDING, ledger.values().iterator().next().getStatus());
    }

    @Test
    @DisplayName("an UNKNOWN result also leaves it pending")
    void unknownStaysPending() {
        when(provider.pay(any(), any())).thenReturn(BillerProvider.PaymentResult.unknown("REF-3"));

        BillPaymentResponse response = service.pay(user(), request("100.00"));

        assertEquals("PENDING", response.getStatus());
        assertEquals(new BigDecimal("400.00"), wallet.getBalance());
    }

    // ── Reconciliation ────────────────────────────────────────────────────────

    @Test
    @DisplayName("reconciling asks the provider, and a late success completes the payment")
    void reconcileSettlesALateSuccess() {
        BillPayment stuck = pendingPayment("100.00");
        when(billPaymentRepository.findStuckPending(any())).thenReturn(List.of(stuck));
        when(provider.status("REF-4")).thenReturn(
                BillerProvider.PaymentResult.success("REF-4", "TOKEN-9"));

        assertEquals(1, service.reconcile());
        assertEquals(BillPayment.Status.COMPLETED, stuck.getStatus());
        // Still debited once — the money was already gone, and it stayed gone.
        assertEquals(new BigDecimal("500.00"), wallet.getBalance());
    }

    @Test
    @DisplayName("reconciling a still-unknown payment leaves the money where it is")
    void reconcileLeavesUnknownAlone() {
        BillPayment stuck = pendingPayment("100.00");
        when(billPaymentRepository.findStuckPending(any())).thenReturn(List.of(stuck));
        when(provider.status("REF-4")).thenReturn(BillerProvider.PaymentResult.unknown("REF-4"));

        assertEquals(0, service.reconcile());
        assertEquals(BillPayment.Status.PENDING, stuck.getStatus());
    }

    @Test
    @DisplayName("a payment nobody can resolve is flagged for a person, not auto-refunded")
    void exhaustedReconcileNeedsAHuman() {
        BillPayment stuck = pendingPayment("100.00");
        stuck.setReconcileAttempts(20);
        when(billPaymentRepository.findStuckPending(any())).thenReturn(List.of(stuck));

        service.reconcile();

        assertEquals(BillPayment.Status.FAILED, stuck.getStatus());
        // The provider may be holding the money; guessing would risk paying twice.
        assertEquals(new BigDecimal("500.00"), wallet.getBalance());
        verify(provider, never()).pay(any(), any());
    }

    // ── Guards ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("a wrong passcode moves no money and never reaches the provider")
    void passcodeIsRequired() {
        doThrow(new AppException("Invalid passcode")).when(userService).verifyPasscode(any(), anyString());

        assertThrows(AppException.class, () -> service.pay(user(), request("100.00")));

        assertEquals(new BigDecimal("500.00"), wallet.getBalance());
        verifyNoInteractions(provider);
    }

    @Test
    @DisplayName("a malformed meter number is refused before anything is charged")
    void accountFormatIsCheckedFirst() {
        PayBillRequest req = request("100.00");
        req.setAccountNumber("not-a-meter");

        AppException e = assertThrows(AppException.class, () -> service.pay(user(), req));
        assertEquals("ACCOUNT_INVALID", e.getCode());
        assertEquals(new BigDecimal("500.00"), wallet.getBalance());
        verifyNoInteractions(provider);
    }

    @Test
    @DisplayName("below the biller's floor is refused")
    void amountBelowBillerMinimumIsRefused() {
        AppException e = assertThrows(AppException.class, () -> service.pay(user(), request("2.00")));
        assertEquals("AMOUNT_TOO_SMALL", e.getCode());
        assertEquals(new BigDecimal("500.00"), wallet.getBalance());
    }

    @Test
    @DisplayName("insufficient balance is refused before the provider is called")
    void insufficientBalanceIsRefused() {
        AppException e = assertThrows(AppException.class, () -> service.pay(user(), request("900.00")));
        assertEquals("INSUFFICIENT_FUNDS", e.getCode());
        verifyNoInteractions(provider);
    }

    @Test
    @DisplayName("replaying the key returns the first payment and charges once")
    void replayIsNotASecondPayment() {
        when(provider.pay(any(), any())).thenReturn(BillerProvider.PaymentResult.success("REF-1", null));
        PayBillRequest req = request("100.00");
        BillPaymentResponse first = service.pay(user(), req);

        BillPayment existing = payments.get(UUID.fromString(first.getId()));
        when(billPaymentRepository.findByUserIdAndIdempotencyKey(userId, req.getIdempotencyKey()))
                .thenReturn(Optional.of(existing));

        BillPaymentResponse second = service.pay(user(), req);

        assertEquals(first.getId(), second.getId());
        assertEquals(new BigDecimal("400.00"), wallet.getBalance());
        verify(provider, times(1)).pay(any(), any());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private BillPayment pendingPayment(String amount) {
        Transaction t = Transaction.builder()
                .id(UUID.randomUUID())
                .senderId(userId).recipientId(userId)
                .amount(new BigDecimal(amount))
                .type(Transaction.TransactionType.BILL_PAY)
                .status(Transaction.TransactionStatus.PENDING)
                .build();
        ledger.put(t.getId(), t);

        BillPayment p = BillPayment.builder()
                .id(UUID.randomUUID())
                .userId(userId)
                .billerId(billerId)
                .accountNumber("12345678")
                .amount(new BigDecimal(amount))
                .status(BillPayment.Status.PENDING)
                .providerReference("REF-4")
                .transactionId(t.getId())
                .idempotencyKey(UUID.randomUUID().toString())
                .build();
        payments.put(p.getId(), p);
        return p;
    }

    private PayBillRequest request(String amount) {
        PayBillRequest req = new PayBillRequest();
        req.setBillerSlug("ecg-prepaid");
        req.setAccountNumber("12345678");
        req.setAmount(new BigDecimal(amount));
        req.setPasscode("1234");
        req.setIdempotencyKey(UUID.randomUUID().toString());
        return req;
    }

    private Biller biller() {
        return Biller.builder()
                .id(billerId)
                .slug("ecg-prepaid")
                .name("ECG Prepaid")
                .category(Biller.Category.ELECTRICITY)
                .accountLabel("Meter number")
                .accountPattern("^[0-9]{8,14}$")
                .minAmount(new BigDecimal("5.00"))
                .maxAmount(new BigDecimal("5000.00"))
                .supportsNameLookup(true)
                .active(true)
                .build();
    }

    private User user() {
        return User.builder()
                .id(userId).firstName("Ama").lastName("Mensah")
                .status(User.AccountStatus.ACTIVE).kycStatus(User.KycStatus.VERIFIED)
                .kycTier(KycTier.TIER_3)
                .customSingleTransactionLimitGhs(new BigDecimal("10000"))
                .customDailyLimitGhs(new BigDecimal("50000"))
                .build();
    }

    private Wallet wallet(String balance) {
        return Wallet.builder()
                .userId(userId).balance(new BigDecimal(balance)).currency("GHS").frozen(false).build();
    }
}
