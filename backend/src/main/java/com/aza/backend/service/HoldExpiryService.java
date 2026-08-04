package com.aza.backend.service;

import com.aza.backend.entity.CheckoutSession;
import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.PaymentHold;
import com.aza.backend.repository.CheckoutSessionRepository;
import com.aza.backend.repository.MerchantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Per-hold transaction boundary for the expiry sweep, plus the webhooks that go with it.
 *
 * Each hold is handled in its own transaction ({@code REQUIRES_NEW}) so one that cannot be
 * settled — a vanished wallet, a lock timeout — fails alone instead of rolling back every
 * other refund in the same sweep.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class HoldExpiryService {

    private final HoldService holdService;
    private final CheckoutService checkoutService;
    private final CheckoutSessionRepository sessionRepository;
    private final MerchantRepository merchantRepository;
    private final NotificationService notificationService;

    /** Tell the integrator (and the payer) that a hold is about to return to the payer. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void warn(PaymentHold hold, int daysOut) {
        if (!holdService.markWarned(hold, daysOut)) return;   // already warned at this mark

        dispatch(hold, "hold.expiring");

        notificationService.sendNotification(
                hold.getPayerUserId(),
                com.aza.backend.entity.Notification.NotificationType.MONEY_RECEIVED,
                "Held payment expiring",
                "A held payment of GHS " + hold.getAmount() + " returns to your wallet in "
                        + daysOut + " day(s) unless it is released.",
                null);

        log.info("Hold expiry warning sent: holdId={}, daysOut={}", hold.getId(), daysOut);
    }

    /** Return an expired hold to the payer and tell the integrator it happened. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void expire(PaymentHold hold) {
        holdService.expire(hold.getId());
        dispatch(hold, "hold.expired_refunded");
    }

    /**
     * Tell the integrator their hold's state changed underneath them. Without this the only
     * signal that Aza froze a hold is their next release call failing with HOLD_FROZEN —
     * they would be debugging their own integration for something Aza did.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notifyStateChange(PaymentHold hold, String eventType) {
        dispatch(hold, eventType);
    }

    private void dispatch(PaymentHold hold, String eventType) {
        CheckoutSession session = sessionRepository.findById(hold.getSessionId()).orElse(null);
        if (session == null) return;
        Merchant merchant = merchantRepository.findById(hold.getMerchantId()).orElse(null);
        checkoutService.scheduleWebhookDelivery(session, merchant, eventType);
    }
}
