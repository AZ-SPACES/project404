package com.aza.backend.dto.agent;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

/**
 * Result of a superagent distributing float down to an agent: the ledger entry plus
 * the superagent's remaining float. Distribution carries no margin.
 */
@Data
@Builder
public class FloatDistributionResponse {
    private String transactionId;
    private BigDecimal amount;
    /** Superagent's float after the distribution. */
    private BigDecimal superAgentFloatBalance;
    private String targetAgentCode;
    private String targetAgentName;
    private String currency;
}
