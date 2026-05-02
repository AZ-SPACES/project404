package com.aza.backend.service;

import com.aza.backend.dto.admin.FeeRuleResponse;
import com.aza.backend.dto.admin.FeeStatsResponse;
import com.aza.backend.entity.FeeRule;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.FeeRuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FeeService {

    private final FeeRuleRepository feeRuleRepository;

    public List<FeeRuleResponse> getFeeRules() {
        return feeRuleRepository.findAllByOrderByTransactionTypeAscEffectiveFromAsc()
                .stream().map(this::toResponse).toList();
    }

    public FeeStatsResponse getStats() {
        long activeRules = feeRuleRepository.countByActiveTrue();
        return FeeStatsResponse.builder()
                .totalFeeRevenueToday(BigDecimal.ZERO)   // populated once fee collection is tracked
                .totalFeeRevenueMonth(BigDecimal.ZERO)
                .averageFeePerTransaction(BigDecimal.ZERO)
                .activeFeeRules(activeRules)
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
