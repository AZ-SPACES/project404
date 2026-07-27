package com.aza.backend.dto.auth;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class BiometricTokenRequest {
    @NotBlank(message = "Passcode is required to enable biometrics")
    private String passcode;

    @NotBlank(message = "Device ID is required")
    private String deviceId;

    private String deviceName;
    private String deviceOs;
}
