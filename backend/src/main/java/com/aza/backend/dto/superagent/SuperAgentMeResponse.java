package com.aza.backend.dto.superagent;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

/**
 * Master-agent entitlement for the portal shell. {@code status} is "NONE" when the caller
 * holds no agent record and "NOT_SUPER" when they are an agent of the standard tier — both
 * render the portal's "no access" state rather than an error.
 */
@Data
@Builder
public class SuperAgentMeResponse {
    private String status;
    private String tier;
    private String code;
    private String businessName;
    private String userName;
    private BigDecimal floatBalance;
    private BigDecimal floatLimit;
    private long subAgentCount;
    private String currency;
}
