package com.aza.backend.dto;

import lombok.Builder;
import lombok.Data;

/**
 * Public (mobile) view of a mini app that is not fully available.
 * Apps with no entry here are active. The message is only populated for
 * MAINTENANCE — kill-switch reasons stay internal.
 */
@Data
@Builder
public class MiniAppStatusResponse {
    private String appId;
    private String status;  // DISABLED | MAINTENANCE
    private String message; // user-facing, MAINTENANCE only
}
