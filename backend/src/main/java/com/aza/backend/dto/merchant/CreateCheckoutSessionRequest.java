package com.aza.backend.dto.merchant;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class CreateCheckoutSessionRequest {

    @NotNull
    @DecimalMin("0.01")
    private BigDecimal amount;

    private String description;
    private String metadata; // arbitrary JSON string
    private String successUrl;
    private String cancelUrl;
    private String idempotencyKey;
}
