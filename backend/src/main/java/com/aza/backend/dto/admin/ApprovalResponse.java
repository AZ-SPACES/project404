package com.aza.backend.dto.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class ApprovalResponse {
    private String id;
    private String actionType;
    private String targetId;
    private String summary;
    private String status;
    private String requestedByEmail;
    private String requestedAt;
    private String reviewedByEmail;
    private String reviewedAt;
    private String reviewNotes;
}
