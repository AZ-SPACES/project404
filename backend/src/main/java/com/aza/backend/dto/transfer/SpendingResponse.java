package com.aza.backend.dto.transfer;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
@AllArgsConstructor
public class SpendingResponse {
    private BigDecimal spentThisMonth;
    private BigDecimal spentLastMonth;
    private String currency;
}
