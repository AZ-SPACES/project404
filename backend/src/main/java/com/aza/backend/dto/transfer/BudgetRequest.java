package com.aza.backend.dto.transfer;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class BudgetRequest {

    @NotBlank(message = "Category is required")
    private String category;

    @NotNull(message = "Budget amount is required")
    @DecimalMin(value = "1.00", message = "Budget must be at least 1.00")
    private BigDecimal budgetAmount;

    private String period;
}
