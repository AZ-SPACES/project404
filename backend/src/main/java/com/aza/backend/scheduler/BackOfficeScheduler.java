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
    private final com.aza.backend.service.StaffAlertService staffAlertService;
    private final com.aza.backend.repository.UserRepository userRepository;

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

    /** Mondays 02:50 — flag verified users whose periodic KYC review is overdue. */
    @Scheduled(cron = "0 50 2 * * MON")
    public void kycReviewsDue() {
        int overdue = userRepository.findByKycStatusAndKycReviewDueAtBefore(
                com.aza.backend.entity.User.KycStatus.VERIFIED, java.time.LocalDateTime.now()).size();
        if (overdue > 0) {
            staffAlertService.alertRole(com.aza.backend.entity.StaffRole.Role.COMPLIANCE,
                    "KYC reviews overdue",
                    overdue + " verified user(s) are past their periodic KYC review date. "
                            + "See the KYC Review page.");
        }
    }

    /** 02:20 — screen all users against active watchlist entries. */
    @Scheduled(cron = "0 20 2 * * *")
    public void watchlistScreening() {
        int raised = screeningService.screenAllUsers();
        if (raised > 0) {
            log.warn("Daily screening raised {} new watchlist matches pending review", raised);
        }
    }

    /**
     * 02:30 — hash-chain anchor for yesterday's admin audit entries. The anchor
     * hash is emailed to every ADMIN so an off-box copy exists in their inboxes:
     * tampering with the database can't also rewrite those emails.
     */
    @Scheduled(cron = "0 30 2 * * *")
    public void anchorAuditLog() {
        int created = auditAnchorService.anchorUpToYesterday();
        if (created > 0) {
            auditAnchorService.recentAnchors().stream().findFirst().ifPresent(anchor ->
                    staffAlertService.alertRole(com.aza.backend.entity.StaffRole.Role.ADMIN,
                            "Audit anchor " + anchor.getAnchorDate(),
                            "Daily audit-log anchor: " + anchor.getEntryCount() + " entries, hash "
                                    + anchor.getContentHash() + " (prev " + anchor.getPrevHash()
                                    + "). Keep this email — it is the off-box integrity record."));
        }
    }
}
