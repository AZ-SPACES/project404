package com.aza.backend.scheduler;

import com.aza.backend.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Nullifies GPS location data from old transaction records.
 * Transactions are retained for AML compliance but location data is
 * anonymised after 2 years to satisfy data-minimisation requirements.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class LocationRetentionScheduler {

    private final TransactionRepository transactionRepository;

    @Scheduled(cron = "0 0 2 * * *")
    @Transactional
    public void nullifyExpiredTransactionLocations() {
        LocalDateTime cutoff = LocalDateTime.now().minusYears(2);
        int updated = transactionRepository.nullifyOldLocations(cutoff);
        if (updated > 0) {
            log.info("Location retention: anonymised {} transaction location(s) older than 2 years", updated);
        }
    }
}
