package com.aza.backend.service;

import com.aza.backend.entity.FeeRule;
import com.aza.backend.entity.MonthlyFeeUsage;
import com.aza.backend.repository.FeeRuleRepository;
import com.aza.backend.repository.MonthlyFeeUsageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.Optional;
import java.util.UUID;

/**
 * Resolves the fee for a (transactionType, amount, payer) tuple from the
 * configurable {@link FeeRule} schedule. This is the single source of truth the
 * quote endpoint and (later) the charging path both read, so the fee shown at
 * confirmation equals the fee charged.
 *
 * <p>Resolution order for a matching active rule whose effective window covers
 * now and whose [tierMin, tierMax] band contains the amount:
 * <ol>
 *   <li>Free tiers — free if {@code amount <= freePerTxnThreshold}, OR if the
 *       payer's running monthly usage + amount is within {@code freeMonthlyThreshold}.</li>
 *   <li>Base — {@code amount * percent/100} (PERCENTAGE) or the flat {@code amount}
 *       (FLAT), plus the optional {@code flatComponent}.</li>
 *   <li>Caps — clamp to {@code minFee} / {@code maxFee}.</li>
 * </ol>
 * No matching rule means no fee.
 */
@Service
@RequiredArgsConstructor
public class FeeCalculationService {

    private static final ZoneId GHANA_TZ = ZoneId.of("Africa/Accra");
    private static final DateTimeFormatter MONTH = DateTimeFormatter.ofPattern("yyyy-MM");

    private final FeeRuleRepository feeRuleRepository;
    private final MonthlyFeeUsageRepository monthlyFeeUsageRepository;

    /** Fee owed plus the rule it came from (null when no rule applied — i.e. free). */
    public record FeeQuote(BigDecimal fee, UUID ruleId, boolean free) {}

    public FeeQuote quote(String transactionType, BigDecimal amount, UUID payerId) {
        if (amount == null || amount.signum() <= 0) {
            return new FeeQuote(BigDecimal.ZERO, null, true);
        }
        LocalDateTime now = LocalDateTime.now(GHANA_TZ);

        FeeRule rule = resolveRule(transactionType, amount, now);
        if (rule == null) {
            return new FeeQuote(BigDecimal.ZERO, null, true);
        }
        if (isFree(rule, amount, payerId, now)) {
            return new FeeQuote(BigDecimal.ZERO, rule.getId(), true);
        }

        BigDecimal base = rule.getFeeType() == FeeRule.FeeType.PERCENTAGE
                ? amount.multiply(rule.getAmount()).divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP)
                : rule.getAmount();
        if (rule.getFlatComponent() != null) {
            base = base.add(rule.getFlatComponent());
        }
        if (rule.getMinFee() != null && base.compareTo(rule.getMinFee()) < 0) {
            base = rule.getMinFee();
        }
        if (rule.getMaxFee() != null && base.compareTo(rule.getMaxFee()) > 0) {
            base = rule.getMaxFee();
        }
        return new FeeQuote(base.setScale(2, RoundingMode.HALF_UP), rule.getId(), false);
    }

    /**
     * Records that the payer moved {@code amount} of {@code transactionType} value this month, so the
     * rolling-monthly free tier is consumed correctly. Call once per charged-or-free transaction, in the
     * same transaction as the money move. Transfers that are free under the per-transaction tier do not
     * consume the monthly allowance (small everyday transfers stay free forever).
     */
    @Transactional
    public void recordMonthlyUsage(String transactionType, BigDecimal amount, UUID payerId) {
        if (payerId == null || amount == null || amount.signum() <= 0) return;
        LocalDateTime now = LocalDateTime.now(GHANA_TZ);
        FeeRule rule = resolveRule(transactionType, amount, now);
        if (rule == null || rule.getFreeMonthlyThreshold() == null) return;
        if (rule.getFreePerTxnThreshold() != null
                && amount.compareTo(rule.getFreePerTxnThreshold()) <= 0) return;

        String month = now.format(MONTH);
        MonthlyFeeUsage usage = monthlyFeeUsageRepository
                .findByUserIdAndTransactionTypeAndUsageMonth(payerId, rule.getTransactionType(), month)
                .orElseGet(() -> MonthlyFeeUsage.builder()
                        .userId(payerId)
                        .transactionType(rule.getTransactionType())
                        .usageMonth(month)
                        .usedAmount(BigDecimal.ZERO)
                        .build());
        usage.setUsedAmount(usage.getUsedAmount().add(amount));
        monthlyFeeUsageRepository.save(usage);
    }

    private FeeRule resolveRule(String transactionType, BigDecimal amount, LocalDateTime now) {
        return feeRuleRepository.findByTransactionTypeAndActiveTrue(transactionType).stream()
                .filter(r -> withinEffectiveWindow(r, now))
                .filter(r -> withinTierBand(r, amount))
                // Prefer the most specific (narrowest) tier band when several match.
                .min(Comparator.comparing(FeeCalculationService::bandWidth))
                .orElse(null);
    }

    private boolean isFree(FeeRule rule, BigDecimal amount, UUID payerId, LocalDateTime now) {
        if (rule.getFreePerTxnThreshold() != null
                && amount.compareTo(rule.getFreePerTxnThreshold()) <= 0) {
            return true;
        }
        if (rule.getFreeMonthlyThreshold() != null && payerId != null) {
            BigDecimal used = monthlyFeeUsageRepository
                    .findByUserIdAndTransactionTypeAndUsageMonth(
                            payerId, rule.getTransactionType(), now.format(MONTH))
                    .map(u -> u.getUsedAmount() != null ? u.getUsedAmount() : BigDecimal.ZERO)
                    .orElse(BigDecimal.ZERO);
            return used.add(amount).compareTo(rule.getFreeMonthlyThreshold()) <= 0;
        }
        return false;
    }

    private static boolean withinEffectiveWindow(FeeRule r, LocalDateTime now) {
        boolean started = r.getEffectiveFrom() == null || !now.isBefore(r.getEffectiveFrom());
        boolean notEnded = r.getEffectiveTo() == null || now.isBefore(r.getEffectiveTo());
        return started && notEnded;
    }

    private static boolean withinTierBand(FeeRule r, BigDecimal amount) {
        boolean aboveMin = r.getTierMinAmount() == null || amount.compareTo(r.getTierMinAmount()) >= 0;
        boolean belowMax = r.getTierMaxAmount() == null || amount.compareTo(r.getTierMaxAmount()) <= 0;
        return aboveMin && belowMax;
    }

    /** Narrower bands sort first; unbounded edges count as very wide. */
    private static BigDecimal bandWidth(FeeRule r) {
        BigDecimal min = Optional.ofNullable(r.getTierMinAmount()).orElse(BigDecimal.ZERO);
        BigDecimal max = Optional.ofNullable(r.getTierMaxAmount())
                .orElse(BigDecimal.valueOf(Long.MAX_VALUE));
        return max.subtract(min);
    }
}
