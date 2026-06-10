package com.aza.backend.dto.qrlogin;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class QrLoginCompleteRequest {
    @NotBlank
    private String challengeToken;

    @NotBlank
    private String sessionSecret;
}
