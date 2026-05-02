package com.aza.backend.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class FeeRuleResponse {
    private String id;
    private String name;
    private String description;
    private String transactionType;
    private String feeType;
    private BigDecimal amount;
    private BigDecimal minFee;
    private BigDecimal maxFee;
    private BigDecimal tierMinAmount;
    private BigDecimal tierMaxAmount;
    private boolean active;
    private LocalDateTime effectiveFrom;
}
