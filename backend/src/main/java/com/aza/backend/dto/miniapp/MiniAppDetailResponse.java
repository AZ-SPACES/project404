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

    // ── Hosting ────────────────────────────────────────────────────────────────

    /** EXTERNAL (developer-hosted) or AZA_HOSTED (uploaded bundle). */
    private String hostingMode;

    /** Live bundle version being served to users. Null until the first approval. */
    private String bundleVersion;

    /** Uploaded bundle awaiting review. Null once promoted. */
    private String pendingBundleVersion;

    private Long bundleSizeBytes;
    private LocalDateTime bundleUploadedAt;

    /** Where the developer or a reviewer can open the pending bundle. Null if none pending. */
    private String previewUrl;
}
