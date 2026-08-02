package com.aza.backend.dto.merchant;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

/**
 * One person to pay when the hold is released. Aza never learns what the money is
 * for — that lives in the session's {@code reference} and {@code metadata}.
 */
@Data
public class HoldRecipientRequest {

    /** Recipient's Aza phone number, email, or username. Must already have an account. */
    @NotBlank
    @Size(max = 255)
    private String recipient;

    /** Fixed amount (GHS) this recipient receives on release. */
    @NotNull
    @DecimalMin("0.01")
    private BigDecimal amount;

    @Size(max = 500)
    private String note;
}
