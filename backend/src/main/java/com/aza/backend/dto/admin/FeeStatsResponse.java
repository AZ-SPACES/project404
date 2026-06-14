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
    /** Share of value (this month) moving digitally vs. through cash, 0..1. The strategic KPI. */
    private BigDecimal digitalRatioMonth;
    /** Outstanding cash-in commission owed to agents (lifetime payable). */
    private BigDecimal agentCommissionPayable;
}
