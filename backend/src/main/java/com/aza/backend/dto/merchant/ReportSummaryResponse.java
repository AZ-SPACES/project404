package com.aza.backend.dto.merchant;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class ReportSummaryResponse {

    private BigDecimal todayRevenue;
    private BigDecimal sevenDayRevenue;
    private BigDecimal thirtyDayRevenue;
    private BigDecimal allTimeRevenue;

    private long todayPayments;
    private long sevenDayPayments;
    private long thirtyDayPayments;
    private long allTimePayments;

    private double successRate;

    private List<DayPoint> dailySeries;

    @Data
    @Builder
    public static class DayPoint {
        private String date;
        private BigDecimal revenue;
        private long count;
    }
}
