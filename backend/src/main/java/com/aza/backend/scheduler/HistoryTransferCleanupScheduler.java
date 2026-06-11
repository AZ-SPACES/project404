package com.aza.backend.scheduler;

import com.aza.backend.service.HistorySyncService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * History transfers are ephemeral by design — the encrypted blobs exist only
 * for the minutes it takes to link a device. This sweeps anything a client
 * abandoned without acking.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class HistoryTransferCleanupScheduler {

    private final HistorySyncService historySyncService;

    @Scheduled(fixedDelay = 15 * 60 * 1000) // every 15 minutes
    public void purgeExpiredTransfers() {
        int purged = historySyncService.purgeExpiredTransfers();
        if (purged > 0) {
            log.info("Purged {} expired history transfers", purged);
        }
    }
}
