package com.aza.backend.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class BiometricEnableRequest {
    @NotBlank(message = "Passcode is required to enable biometrics")
    @Size(min = 5, max = 5, message="Passcode must be 5 digits")
    private String passcode;

    private String deviceName;
    private String deviceOs;
}
