package com.aza.backend.dto.merchant;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class InvoiceResponse {
    private String id;
    private String referenceId;
    private String customerName;
    private String customerEmail;
    private BigDecimal amount;
    private String currency;
    private String description;
    private LocalDate dueDate;
    private String status;
    private String checkoutSessionId;
    private String checkoutUrl;
    private LocalDateTime createdAt;
    private LocalDateTime sentAt;
    private LocalDateTime paidAt;
}
