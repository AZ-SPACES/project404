package com.aza.backend.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class TotpLoginRequest {

    @NotBlank(message = "Pre-auth token is required")
    private String preAuthToken;

    @NotBlank(message = "Authenticator code is required")
    @Pattern(regexp = "\\d{6}", message = "Authenticator code must be exactly 6 digits")
    private String code;

    private String deviceName;
    private String deviceOs;
    private String deviceId;
}
