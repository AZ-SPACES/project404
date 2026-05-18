package com.aza.backend.dto.admin;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AdminAuditLogEntry {
    private String id;
    private String adminId;
    private String adminEmail;
    private String adminName;
    private String action;
    private String targetUserId;
    private String targetUserEmail;
    private String details;
    private String timestamp;
}
