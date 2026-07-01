package com.aza.backend.dto.merchant;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

/** How one seller's share of a checkout payment was settled. */
@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CheckoutSplitInfo {
    private String recipient;
    private BigDecimal amount;
    /** PENDING | CREDITED | FALLBACK_TO_PLATFORM */
    private String status;
    private String failureReason;
}
