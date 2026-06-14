package com.aza.backend.dto.agent;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

/**
 * Agent entitlement + balances for the app. {@code status} is "NONE" when the
 * user is not an agent, which drives the "Become an agent" onboarding funnel.
 */
@Data
@Builder
public class AgentMeResponse {
    private String status;
    private String tier;
    private String code;
    private BigDecimal floatBalance;
    private BigDecimal commissionAccruedGhs;
    private BigDecimal floatLimit;
}
