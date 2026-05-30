package com.aza.backend.dto.transfer;

import com.aza.backend.entity.RecurringTransfer;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class CreateRecurringTransferRequest {

    @NotBlank
    private String recipientIdentifier;

    @NotNull
    @DecimalMin("0.01")
    private BigDecimal amount;

    private String note;

    @NotNull
    private RecurringTransfer.Frequency frequency;

    @NotNull
    private LocalDate startDate;

    /* Optional — if provided, duplicate calls with the same key return the existing record */
    private String idempotencyKey;
}
