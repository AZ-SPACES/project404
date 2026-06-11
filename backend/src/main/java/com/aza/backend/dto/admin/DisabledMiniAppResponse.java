package com.aza.backend.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class DisabledMiniAppResponse {
    private String appId;
    private String reason;
    private String disabledBy;
    private LocalDateTime disabledAt;
}
