package com.aza.backend.dto.agent;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

/** One line of an agent's till history (a cash-in or cash-out they handled). */
@Data
@Builder
public class AgentTransactionResponse {
    private String id;
    private String type;             // CASH_IN | CASH_OUT
    private BigDecimal amount;
    private BigDecimal fee;
    private String counterpartyName; // the customer served
    private String createdAt;
}
