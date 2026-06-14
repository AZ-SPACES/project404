package com.aza.backend.dto.agent;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

/** Agent record for the apply result and the admin queue. */
@Data
@Builder
public class AgentResponse {
    private String id;
    private String userId;
    private String status;
    private String tier;
    private String code;
    private String location;
    private BigDecimal floatBalance;
    private BigDecimal commissionAccruedGhs;
}
