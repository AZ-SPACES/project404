package com.aza.backend.dto.miniapp;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class SdkPaymentRequest {

    @NotNull
    @DecimalMin("0.01")
    private BigDecimal amount;

    /** Aza username, email, or phone of the recipient (usually the developer's account). */
    @NotBlank
    private String recipientIdentifier;

    @Size(max = 200)
    private String note;

    /** Unique key from the mini app to prevent duplicate payments. */
    @NotBlank
    private String idempotencyKey;
}
