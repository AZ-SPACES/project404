package com.aza.backend.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

/**
 * Fee preview for a prospective transaction. The app shows {@code fee} (often
 * GHS 0.00) before the user confirms; {@code ruleId} pins the rule version so the
 * charged fee can be reconciled against the quoted one.
 */
@Data
@Builder
public class FeeQuoteResponse {
    private String transactionType;
    private BigDecimal amount;
    private BigDecimal fee;
    private boolean free;
    private String currency;
    private String ruleId;
}
