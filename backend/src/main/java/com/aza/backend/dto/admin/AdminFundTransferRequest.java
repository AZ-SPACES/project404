package com.aza.backend.dto.admin;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class AdminFundTransferRequest {

    @NotBlank(message = "Recipient email, phone, or handle is required")
    private String recipientIdentifier;

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.01", message = "Amount must be greater than 0")
    @DecimalMax(value = "999999.99", message = "Amount exceeds maximum allowed")
    private BigDecimal amount;

    @NotBlank(message = "A reason is required")
    @Size(max = 500, message = "Reason cannot exceed 500 characters")
    private String reference;
}
