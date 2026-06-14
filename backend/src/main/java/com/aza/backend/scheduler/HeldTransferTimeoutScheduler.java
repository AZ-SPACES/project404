package com.aza.backend.scheduler;

import com.aza.backend.entity.Transaction;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.service.TransferService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Auto-rejects HELD_FOR_REVIEW transfers that no admin has acted on within 48 hours.
 * Prevents funds from being frozen indefinitely and satisfies regulatory SLA requirements.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class HeldTransferTimeoutScheduler {

    private static final int HOLD_TIMEOUT_HOURS = 48;

    private final TransactionRepository transactionRepository;
    private final TransferService transferService;

    @Scheduled(cron = "0 0 * * * *") // top of every hour
    public void autoRejectStaleHeldTransfers() {
        LocalDateTime cutoff = LocalDateTime.now().minusHours(HOLD_TIMEOUT_HOURS);
        List<Transaction> stale = transactionRepository.findStaleHeldTransactions(cutoff);
        if (stale.isEmpty()) return;

        log.warn("Hold timeout: auto-rejecting {} transfer(s) held for over {} hours", stale.size(), HOLD_TIMEOUT_HOURS);
        for (Transaction tx : stale) {
            try {
                transferService.rejectHeldTransfer(tx.getId(), true);
                log.info("Hold timeout: auto-rejected transaction {} (initiated {})", tx.getId(), tx.getInitiatedAt());
            } catch (Exception e) {
                log.error("Hold timeout: failed to auto-reject transaction {}: {}", tx.getId(), e.getMessage());
            }
        }
    }
}
