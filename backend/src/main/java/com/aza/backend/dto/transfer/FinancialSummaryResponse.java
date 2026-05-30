package com.aza.backend.dto.transfer;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
@AllArgsConstructor
public class FinancialSummaryResponse {
    private BigDecimal totalIncome;
    private BigDecimal totalSpent;
    private BigDecimal netChange;
    private BigDecimal balance;
    private String currency;
    private long transactionCount;
}
