package com.aza.backend.dto.notification;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class FcmTokenRequest {
    @NotBlank(message = "FCM token is required")
    private String token;

    @NotBlank(message = "Device ID is required")
    private String deviceId;

    private String deviceName;

    @NotBlank(message = "Platform is required")
    private String platform;
}
