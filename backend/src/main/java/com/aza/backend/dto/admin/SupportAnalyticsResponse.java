package com.aza.backend.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class SupportAnalyticsResponse {
    private long totalTickets;
    private long openTickets;
    private long resolvedToday;
    private double avgFirstResponseMinutes;
    private double avgResolutionHours;
    private double slaComplianceRate;
    private List<CategoryCount> byCategory;
    private List<PriorityCount> byPriority;
    private List<DailyTrend> recentTrend;

    @Data
    @Builder
    public static class CategoryCount {
        private String category;
        private long count;
    }

    @Data
    @Builder
    public static class PriorityCount {
        private String priority;
        private long count;
    }

    @Data
    @Builder
    public static class DailyTrend {
        private String date;
        private long opened;
        private long resolved;
    }
}
