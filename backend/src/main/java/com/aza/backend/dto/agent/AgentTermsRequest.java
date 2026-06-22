package com.aza.backend.dto.agent;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Editable agent commercial/risk terms. Each field is optional — a null leaves that
 * term unchanged. Doubles as the maker-checker payload for UPDATE_AGENT_TERMS.
 */
@Data
@NoArgsConstructor
public class AgentTermsRequest {
    private String tier;                        // STANDARD | SUPER
    private BigDecimal floatLimit;              // cap on float the agent may hold (null clears it? no — null = unchanged)
    private Integer cashInCommissionBps;        // commission AZA pays the agent on cash-in
    private Integer cashOutCommissionShareBps;  // agent's share of the cash-out fee
}
