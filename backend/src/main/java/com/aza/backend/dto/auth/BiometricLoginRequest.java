package com.aza.backend.dto.auth;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class BiometricLoginRequest {

    @NotBlank(message = "Biometric token is required")
    private String biometricToken;

    @NotBlank(message = "Device ID is required")
    private String deviceId;
}
