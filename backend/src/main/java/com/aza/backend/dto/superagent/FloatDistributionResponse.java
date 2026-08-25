package com.aza.backend.dto.superagent;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

/** One row of the distribution ledger, plus the master's float after the movement. */
@Data
@Builder
public class FloatDistributionResponse {
    private String id;
    private String direction;
    private BigDecimal amount;
    private String currency;
    private String subAgentId;
    private String subAgentCode;
    private String subAgentName;
    private String note;
    private String transactionId;
    private BigDecimal superAgentFloatBalance;
    private BigDecimal subAgentFloatBalance;
    private String createdAt;
}
