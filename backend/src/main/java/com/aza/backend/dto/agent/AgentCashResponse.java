package com.aza.backend.dto.agent;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

/** Result of an agent cash-in/out: the ledger entry plus the agent's running float and commission. */
@Data
@Builder
public class AgentCashResponse {
    private String transactionId;
    private String type;
    private BigDecimal amount;
    private BigDecimal fee;
    private BigDecimal commissionAccrued;
    private BigDecimal agentFloatBalance;
    private String customerId;
    private String currency;
}
