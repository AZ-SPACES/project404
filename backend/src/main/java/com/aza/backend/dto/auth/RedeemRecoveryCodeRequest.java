package com.aza.backend.dto.auth;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RedeemRecoveryCodeRequest {

    @NotBlank(message = "Pre-auth token is required")
    private String preAuthToken;

    @NotBlank(message = "Recovery code is required")
    private String recoveryCode;
}
