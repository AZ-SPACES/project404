package com.aza.backend.service;

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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/** Expiry enforcement and the compliance freeze. */
class HoldExpiryTest {

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
    private final UUID payerId = UUID.randomUUID();

    @BeforeEach
    void stubs() {
        when(holdRepository.save(any(PaymentHold.class))).thenAnswer(i -> i.getArgument(0));
        when(eventRepository.save(any(HoldEvent.class))).thenAnswer(i -> i.getArgument(0));
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(i -> {
            Transaction t = i.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            return t;
        });
        when(walletRepository.save(any(Wallet.class))).thenAnswer(i -> i.getArgument(0));
    }

    private PaymentHold hold(LocalDateTime expiresAt) {
        return PaymentHold.builder()
                .id(UUID.randomUUID()).sessionId(sessionId).merchantId(merchantId).payerUserId(payerId)
                .amount(new BigDecimal("250.00")).azaFee(new BigDecimal("3.75"))
                .releasedAmount(BigDecimal.ZERO).refundedAmount(BigDecimal.ZERO)
                .status(PaymentHold.HoldStatus.HELD).expiresAt(expiresAt).testMode(false)
                .build();
    }

    // ── Expiry refunds the payer ──────────────────────────────────────────────

    @Test
    void expiredHold_returnsEverythingToThePayer_asASystemAction() {
        PaymentHold h = hold(LocalDateTime.now().minusMinutes(1));
        Wallet payerWallet = Wallet.builder().userId(payerId).balance(BigDecimal.ZERO)
                .currency("GHS").frozen(false).build();

        when(holdRepository.findById(h.getId())).thenReturn(Optional.of(h));
        when(holdRepository.findBySessionIdForUpdate(sessionId)).thenReturn(Optional.of(h));
        when(walletRepository.findByUserIdForUpdate(payerId)).thenReturn(Optional.of(payerWallet));
        when(userRepository.findById(payerId)).thenReturn(Optional.of(User.builder().id(payerId).build()));
        when(recipientRepository.findAllByHoldId(h.getId())).thenReturn(List.of());
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.empty());

        PaymentHold result = service.expire(h.getId());

        assertEquals(new BigDecimal("250.00"), payerWallet.getBalance());
        assertEquals(PaymentHold.HoldStatus.REFUNDED, result.getStatus());

        // Booked as an expiry, not as an integrator-decided refund — support will be asked
        // to tell those apart.
        verify(eventRepository).save(argThat(e ->
                e.getEventType() == HoldEvent.EventType.EXPIRED_REFUNDED
                        && e.getActorType() == HoldEvent.ActorType.SYSTEM));
    }

    @Test
    void expirySweepIsIdempotent_soARepeatedRunCannotRefundTwice() {
        PaymentHold h = hold(LocalDateTime.now().minusMinutes(1));
        when(holdRepository.findById(h.getId())).thenReturn(Optional.of(h));
        when(holdRepository.findBySessionIdForUpdate(sessionId)).thenReturn(Optional.of(h));
        // The first sweep already recorded this hold's expiry event.
        when(eventRepository.findByHoldIdAndIdempotencyKey(h.getId(), "expiry:" + h.getId()))
                .thenReturn(Optional.of(HoldEvent.builder().holdId(h.getId())
                        .eventType(HoldEvent.EventType.EXPIRED_REFUNDED).build()));

        service.expire(h.getId());

        verify(walletRepository, never()).save(any(Wallet.class));
        assertEquals(BigDecimal.ZERO, h.getRefundedAmount());
    }

    // ── Warnings ──────────────────────────────────────────────────────────────

    @Test
    void eachWarningFiresOnce_notOnEveryHourlySweep() {
        PaymentHold h = hold(LocalDateTime.now().plusDays(6));
        String key = "expiry-warn-7:" + h.getId();

        when(eventRepository.findByHoldIdAndIdempotencyKey(h.getId(), key))
                .thenReturn(Optional.empty())                                   // first sweep
                .thenReturn(Optional.of(HoldEvent.builder().holdId(h.getId()).build())); // later sweeps

        assertTrue(service.markWarned(h, 7), "first sweep should warn");
        assertFalse(service.markWarned(h, 7), "subsequent sweeps must stay quiet");
        verify(eventRepository, times(1)).save(any(HoldEvent.class));
    }

    // ── Compliance freeze ─────────────────────────────────────────────────────

    @Test
    void freezeBlocksSettlement_inBothDirections() {
        PaymentHold h = hold(LocalDateTime.now().plusDays(30));
        when(holdRepository.findById(h.getId())).thenReturn(Optional.of(h));
        when(holdRepository.findBySessionIdForUpdate(sessionId)).thenReturn(Optional.of(h));

        service.freeze(h.getId(), "Sanctions screening match", UUID.randomUUID());

        assertEquals(PaymentHold.HoldStatus.FROZEN, h.getStatus());
        assertNotNull(h.getFrozenAt());
        assertEquals("HOLD_FROZEN", assertThrows(AppException.class,
                () -> service.release(sessionId, merchantId, null, "k1", null)).getCode());
        assertEquals("HOLD_FROZEN", assertThrows(AppException.class,
                () -> service.refund(sessionId, merchantId, null, "k2", null,
                        HoldEvent.ActorType.PLATFORM)).getCode());
    }

    @Test
    void freezeStopsTheClock_soAReviewDoesNotConsumeThePayersWindow() {
        LocalDateTime originalExpiry = LocalDateTime.now().plusDays(10);
        PaymentHold h = hold(originalExpiry);
        h.setStatus(PaymentHold.HoldStatus.FROZEN);
        h.setFrozenReason("Fraud review");
        h.setFrozenAt(LocalDateTime.now().minusDays(3));

        when(holdRepository.findById(h.getId())).thenReturn(Optional.of(h));

        service.unfreeze(h.getId(), UUID.randomUUID());

        assertEquals(PaymentHold.HoldStatus.HELD, h.getStatus());
        assertNull(h.getFrozenReason());
        assertNull(h.getFrozenAt());
        // The three frozen days are given back rather than eaten.
        assertTrue(h.getExpiresAt().isAfter(originalExpiry.plusDays(2)),
                "expiry should extend by roughly the frozen duration");
    }

    // Note: that the sweep skips FROZEN holds is enforced by the `status = HELD` predicate
    // in PaymentHoldRepository.findExpired — a JPQL query, so it is not exercisable here.
    // Verified by the freeze-blocks-settlement test above plus the query's own predicate.

    @Test
    void cannotFreezeAnAlreadySettledHold() {
        PaymentHold h = hold(LocalDateTime.now().plusDays(10));
        h.setStatus(PaymentHold.HoldStatus.RELEASED);
        when(holdRepository.findById(h.getId())).thenReturn(Optional.of(h));

        assertEquals("HOLD_ALREADY_SETTLED", assertThrows(AppException.class,
                () -> service.freeze(h.getId(), "too late", UUID.randomUUID())).getCode());
    }

    @Test
    void complianceCanRefundAFrozenHold_soAFreezeHasAnExit() {
        // A freeze blocks the integrator AND the expiry sweep. Without an admin refund the
        // only way out is unfreezing — which hands control back to the integrator the freeze
        // may exist because of, and leaves safeguarded money parked indefinitely.
        PaymentHold h = hold(LocalDateTime.now().plusDays(20));
        h.setStatus(PaymentHold.HoldStatus.FROZEN);
        h.setFrozenReason("Confirmed fraud");
        h.setFrozenAt(LocalDateTime.now().minusDays(2));
        Wallet payerWallet = Wallet.builder().userId(payerId).balance(BigDecimal.ZERO)
                .currency("GHS").frozen(false).build();

        when(holdRepository.findById(h.getId())).thenReturn(Optional.of(h));
        when(holdRepository.findBySessionIdForUpdate(sessionId)).thenReturn(Optional.of(h));
        when(walletRepository.findByUserIdForUpdate(payerId)).thenReturn(Optional.of(payerWallet));
        when(userRepository.findById(payerId)).thenReturn(Optional.of(User.builder().id(payerId).build()));
        when(recipientRepository.findAllByHoldId(h.getId())).thenReturn(List.of());
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.empty());

        PaymentHold result = service.adminRefund(h.getId(), "Confirmed fraud", UUID.randomUUID());

        assertEquals(new BigDecimal("250.00"), payerWallet.getBalance());
        assertEquals(PaymentHold.HoldStatus.REFUNDED, result.getStatus());
        // The freeze resolves with the hold rather than lingering on a settled row.
        assertNull(result.getFrozenReason());
        assertNull(result.getFrozenAt());
    }

    @Test
    void integratorStillCannotSettleAFrozenHold() {
        // The admin carve-out must not widen the block for everyone else.
        PaymentHold h = hold(LocalDateTime.now().plusDays(20));
        h.setStatus(PaymentHold.HoldStatus.FROZEN);
        when(holdRepository.findBySessionIdForUpdate(sessionId)).thenReturn(Optional.of(h));

        assertEquals("HOLD_FROZEN", assertThrows(AppException.class,
                () -> service.refund(sessionId, merchantId, null, "k", null,
                        HoldEvent.ActorType.PLATFORM)).getCode());
        assertEquals("HOLD_FROZEN", assertThrows(AppException.class,
                () -> service.refund(sessionId, merchantId, null, "k", null,
                        HoldEvent.ActorType.SYSTEM)).getCode());
    }

    @Test
    void unfreezingAHoldThatIsNotFrozen_throws() {
        PaymentHold h = hold(LocalDateTime.now().plusDays(10));
        when(holdRepository.findById(h.getId())).thenReturn(Optional.of(h));

        assertEquals("HOLD_NOT_FROZEN", assertThrows(AppException.class,
                () -> service.unfreeze(h.getId(), UUID.randomUUID())).getCode());
    }
}
