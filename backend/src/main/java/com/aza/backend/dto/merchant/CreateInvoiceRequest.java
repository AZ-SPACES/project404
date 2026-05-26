package com.aza.backend.dto.merchant;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class CreateInvoiceRequest {
    @NotBlank
    private String customerName;
    private String customerEmail;
    @NotNull
    @DecimalMin("0.01")
    private BigDecimal amount;
    private String description;
    private LocalDate dueDate;
}
