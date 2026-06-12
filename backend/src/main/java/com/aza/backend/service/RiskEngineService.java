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

    public void evaluateTransfer(Transaction tx, User sender) {
        try {
            checkLargeTransfer(tx, sender);
            checkVelocity(tx, sender);
        } catch (Exception e) {
            log.error("Risk evaluation failed for transaction {}: {}", tx.getId(), e.getMessage());
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
