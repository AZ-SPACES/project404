// ============================================================
// FILE: dto/auth/OtpVerifyRequest.java
// ============================================================
package com.aza.backend.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class OtpVerifyRequest {

    @NotBlank(message = "Identifier (email or phone) is required")
    private String identifier;

    @NotBlank(message = "OTP code is required")
    @Size(min = 6, max = 6, message = "OTP must be 6 digits")
    private String code;

    @NotBlank(message = "Purpose is required")
    private String purpose;  // "signup", "login", "password_reset"

    private String deviceName;
    private String deviceOs;
    private String deviceId;
}
