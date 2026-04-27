package com.aza.backend.dto.auth;


import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class BiometricTokenResponse {
    private String biometricToken;

    private String deviceId;
    private String expiresAt;
    private String message;
}
