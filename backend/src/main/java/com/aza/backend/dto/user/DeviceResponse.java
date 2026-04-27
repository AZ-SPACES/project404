package com.aza.backend.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
public class DeviceResponse {
    private String id;
    private String deviceName;
    private String deviceOs;
    private String ipAddress;
    private LocalDateTime createdAt;
}
