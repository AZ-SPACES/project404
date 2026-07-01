package com.aza.backend.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class BiometricTokenRequest {
    @NotBlank(message = "Passcode is required to enable biometrics")
    @Size(min = 4, max = 4, message = "Passcode must be exactly 4 digits")
    private String passcode;

    @NotBlank(message = "Device ID is required")
    private String deviceId;

    private String deviceName;
    private String deviceOs;
}
