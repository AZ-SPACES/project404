package com.aza.backend.dto.chat;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class PaymentRequestMessageRequest {

    @NotNull(message = "Chat ID is required")
    private UUID chatId;

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.01", message = "Amount must be at least 0.01")
    @Digits(integer = 13, fraction = 2, message = "Invalid amount format")
    private BigDecimal amount;

    private String note;

    /** Hours until this request expires. Null = no expiry. */
    private Integer expiresInHours;
}
