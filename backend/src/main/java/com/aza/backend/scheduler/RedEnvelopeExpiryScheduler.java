package com.aza.backend.scheduler;

import com.aza.backend.entity.RedEnvelope;
import com.aza.backend.service.RedEnvelopeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Returns unopened Akyede money to whoever sent it.
 *
 * A gift nobody opened is customer money Aza is sitting on, so the clock on it is a
 * promise, not a tidy-up. Each gift is settled in its own transaction inside
 * {@link RedEnvelopeService#expire} so one that cannot be refunded — a closed wallet, a
 * lock timeout — fails alone rather than rolling back every other refund in the sweep.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RedEnvelopeExpiryScheduler {

    private final RedEnvelopeService redEnvelopeService;

    @Scheduled(cron = "0 5 * * * *")
    public void sweep() {
        List<RedEnvelope> expired = redEnvelopeService.findExpired();
        if (expired.isEmpty()) return;

        int refunded = 0;
        for (RedEnvelope gift : expired) {
            try {
                redEnvelopeService.expire(gift.getId());
                refunded++;
            } catch (Exception e) {
                // Left UNOPENED on purpose — the next sweep retries rather than marking
                // the money settled when it never reached anyone.
                log.error("Akyede expiry failed, will retry next sweep: gift={}, sender={}",
                        gift.getId(), gift.getSenderId(), e);
            }
        }
        log.info("Akyede expiry sweep: {} of {} expired gifts settled", refunded, expired.size());
    }
}
