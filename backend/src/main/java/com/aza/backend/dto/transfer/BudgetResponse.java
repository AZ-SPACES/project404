package com.aza.backend.dto.transfer;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
@AllArgsConstructor
public class BudgetResponse {
    private String id;
    private String category;
    private String categoryName;
    private String color;
    private BigDecimal budgetAmount;
    private String period;
    private String createdAt;
    private String updatedAt;

    // Status fields (populated in budget status endpoint)
    private BigDecimal spent;
    private BigDecimal remaining;
    private BigDecimal percentUsed;
}
