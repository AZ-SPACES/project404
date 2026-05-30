package com.aza.backend.dto.transfer;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class MoneyRequestDto {

    @NotBlank(message = "Recipient identifier is required")
    private String fromIdentifier;  // who you're requesting money from

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.01", message = "Amount must be greater than 0")
    @DecimalMax(value = "999999.99", message = "Amount exceeds maximum allowed")
    private BigDecimal amount;

    @Size(max = 500, message = "Note cannot exceed 500 characters")
    private String note;

    /* Optional idempotency key — if set, duplicate requests with same key are deduplicated */
    private String idempotencyKey;
}
