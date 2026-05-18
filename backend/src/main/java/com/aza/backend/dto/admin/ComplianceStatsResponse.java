package com.aza.backend.dto.admin;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ComplianceStatsResponse {
    private long flaggedToday;
    private long pendingReview;
    private long clearedThisMonth;
    private long reportsFiledThisMonth;
    private long highRiskUsers;
    private double averageRiskScore;
}
