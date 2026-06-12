package com.aza.backend.scheduler;

import com.aza.backend.service.ApprovalService;
import com.aza.backend.service.ReconciliationService;
import com.aza.backend.service.ScreeningService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Daily back-office hygiene: stale approvals, safeguarding drift, watchlist screening. */
@Component
@RequiredArgsConstructor
@Slf4j
public class BackOfficeScheduler {

    private final ApprovalService approvalService;
    private final ReconciliationService reconciliationService;
    private final ScreeningService screeningService;
    private final com.aza.backend.service.AuditAnchorService auditAnchorService;

    /** 02:00 — expire maker-checker requests nobody actioned within 7 days. */
    @Scheduled(cron = "0 0 2 * * *")
    public void expireStaleApprovals() {
        approvalService.expireStale();
    }

    /**
     * 02:10 — re-check float against the last entered safeguarding balance, so
     * float growing past the safeguarded amount surfaces between manual entries.
     */
    @Scheduled(cron = "0 10 2 * * *")
    public void safeguardingCheck() {
        reconciliationService.takeScheduledSnapshot();
    }

    /** 02:20 — screen all users against active watchlist entries. */
    @Scheduled(cron = "0 20 2 * * *")
    public void watchlistScreening() {
        int raised = screeningService.screenAllUsers();
        if (raised > 0) {
            log.warn("Daily screening raised {} new watchlist matches pending review", raised);
        }
    }

    /** 02:30 — hash-chain anchor for yesterday's admin audit entries. */
    @Scheduled(cron = "0 30 2 * * *")
    public void anchorAuditLog() {
        auditAnchorService.anchorUpToYesterday();
    }
}
