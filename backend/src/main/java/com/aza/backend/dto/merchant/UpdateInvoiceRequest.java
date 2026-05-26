package com.aza.backend.dto.merchant;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class UpdateInvoiceRequest {
    private String customerName;
    private String customerEmail;
    private BigDecimal amount;
    private String description;
    private LocalDate dueDate;
}
