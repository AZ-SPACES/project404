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
    /** Client-generated device fingerprint — used by admin to block a device. */
    private String deviceId;
    private String deviceName;
    private String deviceOs;
    private String ipAddress;
    private String location;
    private LocalDateTime createdAt;
    private LocalDateTime lastUsedAt;
    /** True for the session that issued the current request — the "This device" row. */
    private boolean currentDevice;
    /** True if this device session has an active WebSocket heartbeat right now. */
    private boolean online;
}
