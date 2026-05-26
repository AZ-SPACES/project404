package com.aza.backend.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class MiniAppReportResponse {
    private String id;
    private String appId;
    private String reportedByUserId;
    private String reportedByHandle;
    private String reason;
    private String details;
    private String status;
    private String resolution;
    private LocalDateTime createdAt;
    private LocalDateTime resolvedAt;
}
