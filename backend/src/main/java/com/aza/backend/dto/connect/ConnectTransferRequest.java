package com.aza.backend.dto.connect;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

/**
 * Push funds from the platform's merchant balance to a single seller's Aza wallet.
 */
@Data
public class ConnectTransferRequest {

    /** The seller's Aza email or username. */
    @NotBlank
    @Size(max = 255)
    private String recipient;

    @NotNull
    @DecimalMin("0.01")
    private BigDecimal amount;

    @Size(max = 500)
    private String note;

    /** Your own reference (e.g. payout id / order group). Returned and filterable. */
    @Size(max = 255)
    private String reference;

    /** Reuse-safe key — retrying with the same key returns the original transfer. */
    @Size(max = 255)
    private String idempotencyKey;
}
