package com.aza.backend.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class FeeStatsResponse {
    private BigDecimal totalFeeRevenueToday;
    private BigDecimal totalFeeRevenueMonth;
    private BigDecimal averageFeePerTransaction;
    private long activeFeeRules;
}
