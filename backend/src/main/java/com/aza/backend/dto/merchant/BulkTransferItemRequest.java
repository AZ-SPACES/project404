package com.aza.backend.dto.merchant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class BulkTransferItemRequest {

    @NotBlank
    private String recipientIdentifier; // email or username

    @NotNull
    @Positive
    private BigDecimal amount;

    private String note;
}
