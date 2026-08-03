package com.aza.backend.scheduler;

import com.aza.backend.entity.PaymentHold;
import com.aza.backend.repository.PaymentHoldRepository;
import com.aza.backend.service.HoldExpiryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Enforces the ceiling on how long Aza sits on a payer's money.
 *
 * A hold whose window runs out with no release call is refunded to the payer: absence of a
 * release is absence of evidence anything was earned, and Aza has no standing to decide
 * otherwise. Warnings go out at T-7 and T-1 so the integrator can act first.
 *
 * FROZEN holds are excluded by the repository's status predicate — that is how a compliance
 * review stops the clock, and unfreezing gives the window back.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class HoldExpiryScheduler {

    private static final int[] WARNING_DAYS = {7, 1};

    private final PaymentHoldRepository holdRepository;
    private final HoldExpiryService expiryService;

    /** Top of every hour — matches HeldTransferTimeoutScheduler's cadence. */
    @Scheduled(cron = "0 0 * * * *")
    public void sweep() {
        warnExpiring();
        refundExpired();
    }

    private void warnExpiring() {
        LocalDateTime now = LocalDateTime.now();
        for (int days : WARNING_DAYS) {
            // Window is [N-1, N] days out, not [0, N]. A plain "expires within N days" query
            // would fire the 7-day warning on a hold hours from expiring — telling the
            // integrator they have a week when they have an afternoon. Each warning still
            // fires once per hold; the hold_events idempotency constraint dedupes across the
            // ~24 hourly sweeps that see the same hold inside its window.
            List<PaymentHold> due = holdRepository.findExpiringBetween(
                    now.plusDays(days - 1L), now.plusDays(days));
            for (PaymentHold hold : due) {
                try {
                    expiryService.warn(hold, days);
                } catch (Exception e) {
                    log.error("Hold expiry: failed to warn on hold {} ({} day): {}",
                            hold.getId(), days, e.getMessage());
                }
            }
        }
    }

    private void refundExpired() {
        List<PaymentHold> expired = holdRepository.findExpired(LocalDateTime.now());
        if (expired.isEmpty()) return;

        log.warn("Hold expiry: auto-refunding {} hold(s) past their window", expired.size());
        for (PaymentHold hold : expired) {
            try {
                expiryService.expire(hold);
                log.info("Hold expiry: auto-refunded hold {} (held {}, expired {})",
                        hold.getId(), hold.getHeldAt(), hold.getExpiresAt());
            } catch (Exception e) {
                // One stuck hold must not stop the sweep — the rest still need refunding.
                log.error("Hold expiry: failed to auto-refund hold {}: {}", hold.getId(), e.getMessage());
            }
        }
    }
}
