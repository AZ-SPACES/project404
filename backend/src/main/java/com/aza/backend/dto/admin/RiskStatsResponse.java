package com.aza.backend.dto.admin;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class RiskStatsResponse {
    private long openAlerts;
    private long criticalAlerts;
    private long investigatingAlerts;
    private long resolvedToday;
    private double averageRiskScore;
}
