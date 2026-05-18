package com.aza.backend.dto.transfer;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Map;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class YearlySpendingResponse {
    private Map<String, MonthSpending> months;
    private String currency;

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class MonthSpending {
        private BigDecimal spent;
        private BigDecimal avg;
    }
}
