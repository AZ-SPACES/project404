package com.aza.backend.service;

import com.aza.backend.dto.merchant.HoldRecipientRequest;
import com.aza.backend.dto.merchant.RefundHoldRequest;
import com.aza.backend.dto.merchant.ReleaseHoldRequest;
import com.aza.backend.entity.*;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Settlement behaviour of payment holds: release, refund, unpayable recipients, replay. */
class HoldServiceTest {

    private final PaymentHoldRepository holdRepository = mock(PaymentHoldRepository.class);
    private final HoldRecipientRepository recipientRepository = mock(HoldRecipientRepository.class);
    private final HoldEventRepository eventRepository = mock(HoldEventRepository.class);
    private final CheckoutSessionRepository sessionRepository = mock(CheckoutSessionRepository.class);
    private final MerchantRepository merchantRepository = mock(MerchantRepository.class);
    private final WalletRepository walletRepository = mock(WalletRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final TransactionRepository transactionRepository = mock(TransactionRepository.class);
    private final RecipientResolver recipientResolver = mock(RecipientResolver.class);
    private final NotificationService notificationService = mock(NotificationService.class);

    private final HoldService service = new HoldService(
            holdRepository, recipientRepository, eventRepository, sessionRepository,
            merchantRepository, walletRepository, userRepository, transactionRepository,
            recipientResolver, notificationService);

    private final UUID sessionId = UUID.randomUUID();
    private final UUID merchantId = UUID.randomUUID();
    private final UUID ownerUserId = UUID.randomUUID();
    private final UUID payerId = UUID.randomUUID();
    private final UUID workerId = UUID.randomUUID();

    @BeforeEach
    void stubSaves() {
        when(holdRepository.save(any(PaymentHold.class))).thenAnswer(i -> i.getArgument(0));
        when(recipientRepository.save(any(HoldRecipient.class))).thenAnswer(i -> i.getArgument(0));
        when(eventRepository.save(any(HoldEvent.class))).thenAnswer(i -> i.getArgument(0));
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(i -> {
            Transaction t = i.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            return t;
        });
        when(walletRepository.save(any(Wallet.class))).thenAnswer(i -> i.getArgument(0));
        when(merchantRepository.save(any(Merchant.class))).thenAnswer(i -> i.getArgument(0));
    }

    private PaymentHold heldHold(String amount, String fee) {
        return PaymentHold.builder()
                .id(UUID.randomUUID()).sessionId(sessionId).merchantId(merchantId)
                .payerUserId(payerId)
                .amount(new BigDecimal(amount)).azaFee(new BigDecimal(fee))
                .releasedAmount(BigDecimal.ZERO).refundedAmount(BigDecimal.ZERO)
                .status(PaymentHold.HoldStatus.HELD)
                .expiresAt(LocalDateTime.now().plusDays(30))
                .testMode(false)
                .build();
    }

    private HoldRecipient recipient(String amount) {
        return HoldRecipient.builder()
                .id(UUID.randomUUID()).holdId(UUID.randomUUID()).userId(workerId)
                .identifier("+233241234567").amount(new BigDecimal(amount))
                .releasedAmount(BigDecimal.ZERO).status(HoldRecipient.Status.PENDING)
                .build();
    }

    private Merchant merchant(String balance) {
        return Merchant.builder().id(merchantId).userId(ownerUserId).businessName("JobsCo")
                .status(Merchant.MerchantStatus.ACTIVE).balance(new BigDecimal(balance))
                .currency("GHS").totalVolume(BigDecimal.ZERO).feeRateBps(150).build();
    }

    private void stubPayableWorker() {
        User worker = User.builder().id(workerId).status(User.AccountStatus.ACTIVE).build();
        when(recipientResolver.resolve("+233241234567"))
                .thenReturn(new RecipientResolver.Resolution(worker, null));
        when(walletRepository.findByUserIdForUpdate(workerId))
                .thenReturn(Optional.of(Wallet.builder().userId(workerId)
                        .balance(BigDecimal.ZERO).currency("GHS").frozen(false).build()));
    }

    // ── Release ───────────────────────────────────────────────────────────────

    @Test
    void release_paysRecipient_andSettlesPlatformRemainderNetOfFee() {
        PaymentHold hold = heldHold("250.00", "3.75");
        HoldRecipient worker = recipient("200.00");
        Merchant m = merchant("0.00");

        when(holdRepository.findBySessionIdForUpdate(sessionId)).thenReturn(Optional.of(hold));
        when(recipientRepository.findAllByHoldId(hold.getId())).thenReturn(List.of(worker));
        when(merchantRepository.findByIdForUpdate(merchantId)).thenReturn(Optional.of(m));
        stubPayableWorker();

        PaymentHold result = service.release(sessionId, merchantId, null, "rel-1", null);

        // Worker paid in full.
        assertEquals(new BigDecimal("200.00"), worker.getReleasedAmount());
        assertEquals(HoldRecipient.Status.RELEASED, worker.getStatus());
        // Platform keeps 250 − 200 − 3.75 fee.
        assertEquals(new BigDecimal("46.25"), m.getBalance());
        // Whole hold settled.
        assertEquals(PaymentHold.HoldStatus.RELEASED, result.getStatus());
        assertEquals(new BigDecimal("250.00"), result.getReleasedAmount());
        assertNotNull(result.getResolvedAt());
    }

    @Test
    void release_unpayableRecipient_keepsFundsHeld_andNeverPaysPlatform() {
        PaymentHold hold = heldHold("250.00", "3.75");
        HoldRecipient worker = recipient("200.00");
        Merchant m = merchant("0.00");

        when(holdRepository.findBySessionIdForUpdate(sessionId)).thenReturn(Optional.of(hold));
        when(recipientRepository.findAllByHoldId(hold.getId())).thenReturn(List.of(worker));
        when(merchantRepository.findByIdForUpdate(merchantId)).thenReturn(Optional.of(m));
        when(recipientResolver.resolve("+233241234567")).thenReturn(
                new RecipientResolver.Resolution(null, RecipientResolver.Unpayable.WALLET_FROZEN));

        PaymentHold result = service.release(sessionId, merchantId, null, "rel-2", null);

        // The money a worker earned must never fall back to the platform.
        assertEquals(new BigDecimal("0.00"), m.getBalance());
        assertEquals(HoldRecipient.Status.RELEASE_FAILED, worker.getStatus());
        assertEquals("Recipient wallet is frozen", worker.getFailureReason());
        // Still held, still settleable once the wallet is unfrozen.
        assertEquals(PaymentHold.HoldStatus.HELD, result.getStatus());
        assertEquals(BigDecimal.ZERO, result.getReleasedAmount());
        verify(walletRepository, never()).save(any(Wallet.class));
    }

    @Test
    void release_partial_paysRecipientOnly_andLeavesRestHeld() {
        PaymentHold hold = heldHold("250.00", "3.75");
        HoldRecipient worker = recipient("200.00");
        Merchant m = merchant("0.00");

        when(holdRepository.findBySessionIdForUpdate(sessionId)).thenReturn(Optional.of(hold));
        when(recipientRepository.findAllByHoldId(hold.getId())).thenReturn(List.of(worker));
        when(merchantRepository.findByIdForUpdate(merchantId)).thenReturn(Optional.of(m));
        stubPayableWorker();

        HoldRecipientRequest partial = new HoldRecipientRequest();
        partial.setRecipient("+233241234567");
        partial.setAmount(new BigDecimal("80.00"));
        ReleaseHoldRequest request = new ReleaseHoldRequest();
        request.setRecipients(List.of(partial));

        PaymentHold result = service.release(sessionId, merchantId, request, "rel-3", null);

        assertEquals(new BigDecimal("80.00"), worker.getReleasedAmount());
        // Platform draws nothing until every recipient obligation is settled.
        assertEquals(new BigDecimal("0.00"), m.getBalance());
        assertEquals(PaymentHold.HoldStatus.HELD, result.getStatus());
        assertEquals(new BigDecimal("170.00"),
                result.getAmount().subtract(result.getReleasedAmount()).subtract(result.getRefundedAmount()));
    }

    @Test
    void release_moreThanHeld_throws() {
        PaymentHold hold = heldHold("100.00", "1.50");
        HoldRecipient worker = recipient("80.00");

        when(holdRepository.findBySessionIdForUpdate(sessionId)).thenReturn(Optional.of(hold));
        when(recipientRepository.findAllByHoldId(hold.getId())).thenReturn(List.of(worker));

        HoldRecipientRequest tooMuch = new HoldRecipientRequest();
        tooMuch.setRecipient("+233241234567");
        tooMuch.setAmount(new BigDecimal("500.00"));
        ReleaseHoldRequest request = new ReleaseHoldRequest();
        request.setRecipients(List.of(tooMuch));

        AppException ex = assertThrows(AppException.class,
                () -> service.release(sessionId, merchantId, request, "rel-4", null));
        assertEquals("RELEASE_EXCEEDS_HELD", ex.getCode());
    }

    @Test
    void release_replayOfSameIdempotencyKey_movesNoMoneyTwice() {
        PaymentHold hold = heldHold("250.00", "3.75");
        when(holdRepository.findBySessionIdForUpdate(sessionId)).thenReturn(Optional.of(hold));
        when(eventRepository.findByHoldIdAndIdempotencyKey(hold.getId(), "rel-dup"))
                .thenReturn(Optional.of(HoldEvent.builder().holdId(hold.getId())
                        .eventType(HoldEvent.EventType.RELEASED).idempotencyKey("rel-dup").build()));

        PaymentHold result = service.release(sessionId, merchantId, null, "rel-dup", null);

        assertEquals(BigDecimal.ZERO, result.getReleasedAmount());
        verify(walletRepository, never()).save(any(Wallet.class));
        verify(transactionRepository, never()).save(any(Transaction.class));
    }

    // ── Refund ────────────────────────────────────────────────────────────────

    @Test
    void refund_returnsFullAmountToPayer_includingFee() {
        PaymentHold hold = heldHold("250.00", "3.75");
        Wallet payerWallet = Wallet.builder().userId(payerId).balance(new BigDecimal("10.00"))
                .currency("GHS").frozen(false).build();

        when(holdRepository.findBySessionIdForUpdate(sessionId)).thenReturn(Optional.of(hold));
        when(walletRepository.findByUserIdForUpdate(payerId)).thenReturn(Optional.of(payerWallet));
        when(userRepository.findById(payerId)).thenReturn(Optional.of(User.builder().id(payerId).build()));
        when(recipientRepository.findAllByHoldId(hold.getId())).thenReturn(List.of());
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.empty());

        PaymentHold result = service.refund(sessionId, merchantId, null, "ref-1", null,
                HoldEvent.ActorType.PLATFORM);

        // Payer made whole: the full 250 including the fee Aza would have taken.
        assertEquals(new BigDecimal("260.00"), payerWallet.getBalance());
        assertEquals(PaymentHold.HoldStatus.REFUNDED, result.getStatus());
        assertEquals(new BigDecimal("250.00"), result.getRefundedAmount());
    }

    @Test
    void refund_cannotFail_whenRecipientAlreadySpentTheirOwnMoney() {
        // The instant-settlement path can throw SELLER_CLAWBACK_INSUFFICIENT because the
        // seller was already credited. A held refund touches only the payer, so a
        // recipient's own balance is irrelevant — this must simply succeed.
        PaymentHold hold = heldHold("250.00", "3.75");
        Wallet payerWallet = Wallet.builder().userId(payerId).balance(BigDecimal.ZERO)
                .currency("GHS").frozen(false).build();

        when(holdRepository.findBySessionIdForUpdate(sessionId)).thenReturn(Optional.of(hold));
        when(walletRepository.findByUserIdForUpdate(payerId)).thenReturn(Optional.of(payerWallet));
        when(userRepository.findById(payerId)).thenReturn(Optional.of(User.builder().id(payerId).build()));
        when(recipientRepository.findAllByHoldId(hold.getId())).thenReturn(List.of(recipient("200.00")));
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.empty());

        assertDoesNotThrow(() -> service.refund(sessionId, merchantId, null, "ref-2", null,
                HoldEvent.ActorType.PLATFORM));
        assertEquals(new BigDecimal("250.00"), payerWallet.getBalance());
    }

    // ── Guards ────────────────────────────────────────────────────────────────

    @Test
    void settlingAnotherMerchantsHold_is404_notAnOwnershipHint() {
        PaymentHold hold = heldHold("250.00", "3.75");
        when(holdRepository.findBySessionIdForUpdate(sessionId)).thenReturn(Optional.of(hold));

        AppException ex = assertThrows(AppException.class,
                () -> service.release(sessionId, UUID.randomUUID(), null, "rel-5", null));
        assertEquals("NOT_FOUND", ex.getCode());
    }

    @Test
    void frozenHold_blocksBothReleaseAndRefund() {
        PaymentHold hold = heldHold("250.00", "3.75");
        hold.setStatus(PaymentHold.HoldStatus.FROZEN);
        hold.setFrozenReason("Compliance review");
        when(holdRepository.findBySessionIdForUpdate(sessionId)).thenReturn(Optional.of(hold));

        assertEquals("HOLD_FROZEN", assertThrows(AppException.class,
                () -> service.release(sessionId, merchantId, null, "rel-6", null)).getCode());
        assertEquals("HOLD_FROZEN", assertThrows(AppException.class,
                () -> service.refund(sessionId, merchantId, null, "ref-3", null,
                        HoldEvent.ActorType.PLATFORM)).getCode());
    }

    @Test
    void alreadySettledHold_cannotBeSettledAgain() {
        PaymentHold hold = heldHold("250.00", "3.75");
        hold.setStatus(PaymentHold.HoldStatus.RELEASED);
        when(holdRepository.findBySessionIdForUpdate(sessionId)).thenReturn(Optional.of(hold));

        AppException ex = assertThrows(AppException.class,
                () -> service.release(sessionId, merchantId, null, "rel-7", null));
        assertEquals("HOLD_ALREADY_SETTLED", ex.getCode());
    }

    @Test
    void fee_isBookedOnlyWhenTheHoldActuallySettles() {
        // The fee dashboard sums Transaction.feeAmount. Capture must book nothing —
        // a refunded hold returns the fee in full, so booking it early reports revenue
        // Aza may never keep.
        PaymentHold hold = heldHold("250.00", "3.75");
        HoldRecipient worker = recipient("200.00");
        Merchant m = merchant("0.00");
        UUID captureTxId = UUID.randomUUID();
        Transaction captureTx = Transaction.builder()
                .id(captureTxId).senderId(payerId).recipientId(ownerUserId)
                .amount(new BigDecimal("250.00")).feeAmount(BigDecimal.ZERO)
                .status(Transaction.TransactionStatus.COMPLETED).build();

        when(holdRepository.findBySessionIdForUpdate(sessionId)).thenReturn(Optional.of(hold));
        when(recipientRepository.findAllByHoldId(hold.getId())).thenReturn(List.of(worker));
        when(merchantRepository.findByIdForUpdate(merchantId)).thenReturn(Optional.of(m));
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(
                CheckoutSession.builder().id(sessionId).transactionId(captureTxId).build()));
        when(transactionRepository.findById(captureTxId)).thenReturn(Optional.of(captureTx));
        stubPayableWorker();

        service.release(sessionId, merchantId, null, "rel-fee", null);

        assertEquals(new BigDecimal("3.75"), captureTx.getFeeAmount(),
                "the fee becomes revenue at release, not at capture");
    }

    @Test
    void refundedHold_neverBooksTheFee() {
        PaymentHold hold = heldHold("250.00", "3.75");
        Wallet payerWallet = Wallet.builder().userId(payerId).balance(BigDecimal.ZERO)
                .currency("GHS").frozen(false).build();

        when(holdRepository.findBySessionIdForUpdate(sessionId)).thenReturn(Optional.of(hold));
        when(walletRepository.findByUserIdForUpdate(payerId)).thenReturn(Optional.of(payerWallet));
        when(userRepository.findById(payerId)).thenReturn(Optional.of(User.builder().id(payerId).build()));
        when(recipientRepository.findAllByHoldId(hold.getId())).thenReturn(List.of());
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.empty());

        service.refund(sessionId, merchantId, null, "ref-fee", null, HoldEvent.ActorType.PLATFORM);

        // Payer got the whole 250 back, fee included; nothing was booked as revenue.
        assertEquals(new BigDecimal("250.00"), payerWallet.getBalance());
        verify(transactionRepository, never()).findById(any(UUID.class));
    }

    @Test
    void testModeHold_settlesStateButMovesNoMoney() {
        PaymentHold hold = heldHold("250.00", "3.75");
        hold.setTestMode(true);
        HoldRecipient worker = recipient("200.00");
        Merchant m = merchant("0.00");

        when(holdRepository.findBySessionIdForUpdate(sessionId)).thenReturn(Optional.of(hold));
        when(recipientRepository.findAllByHoldId(hold.getId())).thenReturn(List.of(worker));
        when(merchantRepository.findByIdForUpdate(merchantId)).thenReturn(Optional.of(m));
        stubPayableWorker();

        PaymentHold result = service.release(sessionId, merchantId, null, "rel-8", null);

        assertEquals(PaymentHold.HoldStatus.RELEASED, result.getStatus());
        assertEquals(HoldRecipient.Status.RELEASED, worker.getStatus());
        assertEquals(new BigDecimal("0.00"), m.getBalance());
        verify(walletRepository, never()).save(any(Wallet.class));
    }
}
