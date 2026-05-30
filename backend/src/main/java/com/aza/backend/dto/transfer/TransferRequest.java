package com.aza.backend.dto.transfer;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class TransferRequest {

    @NotBlank(message = "Recipient identifier is required")
    private String recipientIdentifier;  // email, phone, or userId

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.01", message = "Amount must be greater than 0")
    @DecimalMax(value = "999999.99", message = "Amount exceeds maximum allowed")
    private BigDecimal amount;

    @Size(max = 500, message = "Note cannot exceed 500 characters")
    private String note;

    @NotBlank(message = "Idempotency key is required")
    private String idempotencyKey;

    private String category;
}
