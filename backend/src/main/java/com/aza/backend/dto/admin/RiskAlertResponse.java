package com.aza.backend.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class RiskAlertResponse {
    private String id;
    private String userId;
    private String userName;
    private String userHandle;
    private String alertType;
    private String severity;
    private String description;
    private String transactionId;
    private int riskScore;
    private LocalDateTime triggeredAt;
    private String status;
    private String notes;
}
