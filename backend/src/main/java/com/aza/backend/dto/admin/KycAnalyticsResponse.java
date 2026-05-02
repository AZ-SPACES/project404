package com.aza.backend.dto.admin;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class KycAnalyticsResponse {
    private long notStarted;
    private long pending;
    private long underReview;
    private long verified;
    private long rejected;
    private long approvedLast30Days;
    private long rejectedLast30Days;
    private long submittedLast30Days;
    private double approvalRate;
}
