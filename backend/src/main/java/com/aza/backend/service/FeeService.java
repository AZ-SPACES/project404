package com.aza.backend.service;

import com.aza.backend.dto.admin.FeeRuleResponse;
import com.aza.backend.dto.admin.FeeStatsResponse;
import com.aza.backend.entity.FeeRule;
import com.aza.backend.entity.Transaction;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.AgentRepository;
import com.aza.backend.repository.FeeRuleRepository;
import com.aza.backend.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FeeService {

    private static final ZoneId GHANA_TZ = ZoneId.of("Africa/Accra");
    /** Types that move physical cash; everything else completed is "digital" for the ratio. */
    private static final List<Transaction.TransactionType> CASH_TYPES =
            List.of(Transaction.TransactionType.CASH_IN, Transaction.TransactionType.CASH_OUT);

    private final FeeRuleRepository feeRuleRepository;
    private final TransactionRepository transactionRepository;
    private final AgentRepository agentRepository;

    public List<FeeRuleResponse> getFeeRules() {
        return feeRuleRepository.findAllByOrderByTransactionTypeAscEffectiveFromAsc()
                .stream().map(this::toResponse).toList();
    }

    public FeeStatsResponse getStats() {
        LocalDateTime startOfDay = LocalDate.now(GHANA_TZ).atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1);
        LocalDateTime startOfMonth = startOfDay.withDayOfMonth(1);
        LocalDateTime startOfNextMonth = startOfMonth.plusMonths(1);

        BigDecimal revenueToday = transactionRepository.sumFeeBetween(startOfDay, endOfDay);
        BigDecimal revenueMonth = transactionRepository.sumFeeBetween(startOfMonth, startOfNextMonth);
        long feeBearingMonth = transactionRepository.countFeeBearingBetween(startOfMonth, startOfNextMonth);
        BigDecimal avgFee = feeBearingMonth > 0
                ? revenueMonth.divide(BigDecimal.valueOf(feeBearingMonth), 2, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        BigDecimal totalMonth = transactionRepository.sumCompletedAmountBetween(startOfMonth, startOfNextMonth);
        BigDecimal cashMonth = transactionRepository.sumCompletedAmountByTypesBetween(
                CASH_TYPES, startOfMonth, startOfNextMonth);
        BigDecimal digitalRatio = totalMonth.signum() > 0
                ? totalMonth.subtract(cashMonth).divide(totalMonth, 4, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        return FeeStatsResponse.builder()
                .totalFeeRevenueToday(revenueToday)
                .totalFeeRevenueMonth(revenueMonth)
                .averageFeePerTransaction(avgFee)
                .activeFeeRules(feeRuleRepository.countByActiveTrue())
                .digitalRatioMonth(digitalRatio)
                .agentCommissionPayable(agentRepository.sumCommissionAccrued())
                .build();
    }

    @Transactional
    public FeeRuleResponse updateRule(UUID id, FeeRuleUpdateRequest req) {
        FeeRule rule = feeRuleRepository.findById(id)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Fee rule not found", HttpStatus.NOT_FOUND));

        if (req.getAmount() != null) rule.setAmount(req.getAmount());
        if (req.getActive() != null) rule.setActive(req.getActive());
        if (req.getMinFee() != null) rule.setMinFee(req.getMinFee());
        if (req.getMaxFee() != null) rule.setMaxFee(req.getMaxFee());

        return toResponse(feeRuleRepository.save(rule));
    }

    private FeeRuleResponse toResponse(FeeRule r) {
        return FeeRuleResponse.builder()
                .id(r.getId().toString())
                .name(r.getName())
                .description(r.getDescription())
                .transactionType(r.getTransactionType())
                .feeType(r.getFeeType().name())
                .amount(r.getAmount())
                .minFee(r.getMinFee())
                .maxFee(r.getMaxFee())
                .tierMinAmount(r.getTierMinAmount())
                .tierMaxAmount(r.getTierMaxAmount())
                .active(Boolean.TRUE.equals(r.getActive()))
                .effectiveFrom(r.getEffectiveFrom())
                .build();
    }

    @lombok.Data
    public static class FeeRuleUpdateRequest {
        private BigDecimal amount;
        private Boolean active;
        private BigDecimal minFee;
        private BigDecimal maxFee;
    }
}
