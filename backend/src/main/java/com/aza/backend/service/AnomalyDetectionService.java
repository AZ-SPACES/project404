package com.aza.backend.service;

import com.aza.backend.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AnomalyDetectionService {

    private final TransactionRepository transactionRepository;

    public record Result(double score, String riskLevel, String reason) {}

    public Result score(UUID userId, UUID recipientId, BigDecimal amount, LocalDateTime now) {
        double score = 0.0;
        List<String> flags = new ArrayList<>();

        LocalDateTime ninetyDaysAgo = now.minusDays(90);

        // Factor 1: New recipient — no prior completed sends
        long priorSends = transactionRepository.countCompletedDebitsByUserAndRecipient(userId, recipientId);
        if (priorSends == 0) {
            score += 0.30;
            flags.add("First transfer to this recipient");
        }

        // Factor 2: Amount vs. user's historical average and maximum
        long totalSends = transactionRepository.countCompletedDebitsByUser(userId, ninetyDaysAgo);
        if (totalSends > 0) {
            BigDecimal avg = transactionRepository.getAverageAmountByUser(userId, ninetyDaysAgo);
            BigDecimal max = transactionRepository.getMaxAmountByUser(userId, ninetyDaysAgo);

            if (avg.compareTo(BigDecimal.ZERO) > 0) {
                double ratio = amount.doubleValue() / avg.doubleValue();
                if (ratio > 5.0) {
                    score += 0.30;
                    flags.add(String.format("Amount is %.0fx your average transfer", ratio));
                } else if (ratio > 3.0) {
                    score += 0.20;
                    flags.add(String.format("Amount is %.0fx your average transfer", ratio));
                } else if (ratio > 2.0) {
                    score += 0.10;
                }
            }

            if (max.compareTo(BigDecimal.ZERO) > 0
                    && amount.compareTo(max.multiply(BigDecimal.valueOf(2))) > 0) {
                score += 0.15;
                flags.add("Larger than your previous maximum transfer");
            }
        } else {
            // No transaction history — small uncertainty penalty
            score += 0.10;
        }

        // Factor 3: Odd hours (1am–5am)
        int hour = now.getHour();
        if (hour >= 1 && hour < 5) {
            score += 0.15;
            flags.add("Unusual transfer time");
        }

        score = Math.min(score, 1.0);

        String riskLevel;
        if (score < 0.30) riskLevel = "LOW";
        else if (score < 0.55) riskLevel = "MEDIUM";
        else riskLevel = "HIGH";

        String reason = flags.isEmpty() ? null : String.join("; ", flags);
        return new Result(score, riskLevel, reason);
    }
}
