package com.aza.backend.dto.superagent;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

/**
 * Dashboard figures for one master agent. All amounts are GHS and scoped to this master's
 * own downline — nothing here aggregates across the wider network.
 */
@Data
@Builder
public class SuperAgentSummaryResponse {
    /** The master's own float wallet balance. */
    private BigDecimal floatBalance;
    /** Sum of the float currently sitting in the sub-agents' wallets. */
    private BigDecimal downlineFloat;

    private BigDecimal distributedToday;
    private BigDecimal distributedSevenDays;
    private BigDecimal distributedThirtyDays;
    private BigDecimal recalledThirtyDays;

    private long subAgentsTotal;
    private long subAgentsActive;
    private long subAgentsPending;
    private long subAgentsSuspended;

    /**
     * Commission AZA owes the downline. Reporting only — a master agent never pays it, and
     * distribution never touches it.
     */
    private BigDecimal downlineCommissionAccrued;

    private String currency;
}
