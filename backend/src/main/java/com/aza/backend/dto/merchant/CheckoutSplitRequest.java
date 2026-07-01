package com.aza.backend.dto.merchant;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

/**
 * One seller's fixed share of a checkout payment. When the buyer pays, {@code amount}
 * is credited straight to the seller's Aza wallet; the platform keeps whatever is left
 * after the Aza fee and all splits.
 */
@Data
public class CheckoutSplitRequest {

    /** Seller's Aza email or username. */
    @NotBlank
    @Size(max = 255)
    private String recipient;

    /** Fixed amount (GHS) to route to this seller. */
    @NotNull
    @DecimalMin("0.01")
    private BigDecimal amount;

    @Size(max = 500)
    private String note;
}
