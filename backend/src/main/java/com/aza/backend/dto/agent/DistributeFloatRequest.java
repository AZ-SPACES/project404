package com.aza.backend.dto.agent;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class DistributeFloatRequest {
    /** Till/agent code of the agent receiving the float. */
    private String targetAgentCode;
    private BigDecimal amount;
    private String idempotencyKey;
}
