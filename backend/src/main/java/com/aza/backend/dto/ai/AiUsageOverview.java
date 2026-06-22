package com.aza.backend.dto.ai;

import java.util.List;

/** Aggregate AI-usage metrics for the admin dashboard over a rolling window. */
public record AiUsageOverview(
        long totalCalls,
        long blockedCalls,
        long uniqueUsers,
        List<Count> byEndpoint,
        List<Count> byTopic,
        List<Daily> daily) {

    public record Count(String key, long count) {}

    public record Daily(String date, long count) {}
}
