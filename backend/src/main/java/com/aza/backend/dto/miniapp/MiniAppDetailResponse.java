package com.aza.backend.dto.miniapp;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Set;

/** Full view of a developer's own mini app (includes status, review info). */
@Data
@Builder
public class MiniAppDetailResponse {
    private String id;
    private String name;
    private String description;
    private String category;
    private String iconUrl;
    private String url;
    private String developerName;
    private String supportUrl;
    private String version;
    private String status;
    private Set<String> requestedPermissions;
    private LocalDateTime createdAt;
    private LocalDateTime submittedAt;
    private LocalDateTime reviewedAt;
    private String rejectionReason;
}
