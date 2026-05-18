package com.aza.backend.dto.auth;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class BiometricDeviceResponse {
    private UUID id;
    private String deviceName;
    private String deviceOs;
    private LocalDateTime lastUsedAt;
    private LocalDateTime expiresAt;
    private LocalDateTime createdAt;
}
