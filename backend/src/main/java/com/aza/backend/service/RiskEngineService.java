package com.aza.backend.service;

import com.aza.backend.entity.FlaggedTransaction;
import com.aza.backend.entity.RiskAlert;
import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.User;
import com.aza.backend.repository.FlaggedTransactionRepository;
import com.aza.backend.repository.RiskAlertRepository;
import com.aza.backend.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Rule-based transaction monitoring, run after each completed transfer. This is
 * what actually populates the compliance flagged queue and risk alerts the
 * dashboards read — thresholds come from RiskRuleService so COMPLIANCE can tune
 * them live. Evaluation must never fail a transfer.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RiskEngineService {

    private final RiskRuleService riskRuleService;
    private final FlaggedTransactionRepository flaggedRepository;
    private final RiskAlertRepository riskAlertRepository;
    private final TransactionRepository transactionRepository;
    private final StaffAlertService staffAlertService;
    private final com.aza.backend.repository.RiskDecisionLogRepository decisionLogRepository;

    public void evaluateTransfer(Transaction tx, User sender) {
        try {
            checkLargeTransfer(tx, sender);
            checkVelocity(tx, sender);
            evaluateAnomaly(tx, sender, false);
            recordDecisionLog(tx, sender, false);
        } catch (Exception e) {
            log.error("Risk evaluation failed for transaction {}: {}", tx.getId(), e.getMessage());
        }
    }

    /**
     * Persists the feature snapshot for MEDIUM/HIGH transactions — the training
     * dataset for a future learned model. COMPLIANCE decisions become the labels
     * via recordHeldOutcome.
     */
    public void recordDecisionLog(Transaction tx, User sender, boolean held) {
        try {
            String level = tx.getAnomalyRiskLevel();
            if (!"MEDIUM".equals(level) && !"HIGH".equals(level)) return;
            if (decisionLogRepository.findByTransactionId(tx.getId()).isPresent()) return;
            decisionLogRepository.save(com.aza.backend.entity.RiskDecisionLog.builder()
                    .transactionId(tx.getId())
                    .userId(sender.getId())
                    .amount(tx.getAmount())
                    .anomalyScore(tx.getAnomalyScore())
                    .riskLevel(level)
                    .held(held)
                    .build());
        } catch (Exception e) {
            log.warn("Failed to record risk decision log for {}: {}", tx.getId(), e.getMessage());
        }
    }

    /** Stamps the human label onto the decision log when COMPLIANCE decides a held transfer. */
    public void recordHeldOutcome(java.util.UUID transactionId, com.aza.backend.entity.RiskDecisionLog.Outcome outcome) {
        try {
            decisionLogRepository.findByTransactionId(transactionId).ifPresent(entry -> {
                entry.setOutcome(outcome);
                entry.setDecidedAt(LocalDateTime.now());
                decisionLogRepository.save(entry);
            });
        } catch (Exception e) {
            log.warn("Failed to record held outcome for {}: {}", transactionId, e.getMessage());
        }
    }

    /**
     * Surfaces a HIGH behavioral anomaly score in the compliance queues. When the
     * transfer was intercepted (held=true) COMPLIANCE is alerted to come release
     * or reject it; when it completed anyway (merchant POS, automated flows) the
     * flag is informational.
     */
    public void evaluateAnomaly(Transaction tx, User sender, boolean held) {
        try {
            if (!"HIGH".equals(tx.getAnomalyRiskLevel())) return;
            int score = tx.getAnomalyScore() != null
                    ? (int) Math.round(tx.getAnomalyScore() * 100) : 60;
            flaggedRepository.save(FlaggedTransaction.builder()
                    .transactionId(tx.getId())
                    .userId(sender.getId())
                    .amount(tx.getAmount())
                    .flagReason((held ? "HELD: " : "") + "High behavioral anomaly score")
                    .riskScore(score)
                    .build());
            riskAlertRepository.save(RiskAlert.builder()
                    .userId(sender.getId())
                    .alertType(RiskAlert.AlertType.UNUSUAL_PATTERN)
                    .severity(held ? RiskAlert.Severity.CRITICAL : RiskAlert.Severity.HIGH)
                    .description((held ? "Transfer HELD for review: " : "")
                            + "GHS " + tx.getAmount().toPlainString()
                            + " scored " + score + "/100 on behavioral anomaly checks")
                    .transactionId(tx.getId())
                    .riskScore(score)
                    .build());
            if (held) {
                staffAlertService.alertRole(com.aza.backend.entity.StaffRole.Role.COMPLIANCE,
                        "Transfer held for review",
                        "A transfer of GHS " + tx.getAmount().toPlainString()
                                + " was held on a high anomaly score (" + score
                                + "/100). Release or reject it in Fraud Detection.");
            }
        } catch (Exception e) {
            log.error("Anomaly reporting failed for transaction {}: {}", tx.getId(), e.getMessage());
        }
    }

    private void checkLargeTransfer(Transaction tx, User sender) {
        BigDecimal threshold = riskRuleService.largeTransferThresholdGhs();
        if (tx.getAmount().compareTo(threshold) < 0) return;

        // Score scales with how far past the threshold the amount is (100 at 3x)
        int score = (int) Math.min(100,
                40 + tx.getAmount().divide(threshold, 2, java.math.RoundingMode.HALF_UP).doubleValue() * 20);

        flaggedRepository.save(FlaggedTransaction.builder()
                .transactionId(tx.getId())
                .userId(sender.getId())
                .amount(tx.getAmount())
                .flagReason("Large transfer: GHS " + tx.getAmount().toPlainString()
                        + " ≥ threshold GHS " + threshold.toPlainString())
                .riskScore(score)
                .build());
        riskAlertRepository.save(RiskAlert.builder()
                .userId(sender.getId())
                .alertType(RiskAlert.AlertType.LARGE_TRANSFER)
                .severity(score >= 80 ? RiskAlert.Severity.HIGH : RiskAlert.Severity.MEDIUM)
                .description("Transfer of GHS " + tx.getAmount().toPlainString()
                        + " exceeds the large-transfer threshold (GHS " + threshold.toPlainString() + ")")
                .transactionId(tx.getId())
                .riskScore(score)
                .build());
    }

    private void checkVelocity(Transaction tx, User sender) {
        int max = riskRuleService.velocityMaxHourly();
        long lastHour = transactionRepository.countCompletedDebitsByUser(
                sender.getId(), LocalDateTime.now().minusHours(1));
        if (lastHour <= max) return;

        riskAlertRepository.save(RiskAlert.builder()
                .userId(sender.getId())
                .alertType(RiskAlert.AlertType.VELOCITY)
                .severity(lastHour > max * 2L ? RiskAlert.Severity.HIGH : RiskAlert.Severity.MEDIUM)
                .description(lastHour + " outgoing transfers in the last hour (limit " + max + ")")
                .transactionId(tx.getId())
                .riskScore((int) Math.min(100, lastHour * 100 / Math.max(1, max * 2L)))
                .build());
    }
}
