package com.aza.backend.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/** One row in the admin "all mini apps" list: catalog entry + current status. */
@Data
@Builder
public class AdminMiniAppResponse {
    private String appId;
    private String name;
    private String category;
    private String description;
    private String status;          // ACTIVE | MAINTENANCE | DISABLED
    private String reason;          // null when ACTIVE
    private String statusSetBy;     // admin user id, null when ACTIVE
    private LocalDateTime statusSetAt;
}
