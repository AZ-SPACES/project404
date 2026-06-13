package com.aza.backend.dto.miniapp;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Set;

@Data
@Builder
public class ConsentResponse {
    private String appId;
    private boolean granted;
    private Set<String> grantedPermissions;
    private LocalDateTime grantedAt;
}
