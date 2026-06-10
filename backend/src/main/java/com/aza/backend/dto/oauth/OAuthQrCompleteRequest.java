package com.aza.backend.dto.oauth;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class OAuthQrCompleteRequest {

    @NotBlank
    private String challengeToken;

    @NotBlank
    private String sessionSecret;

    @NotBlank
    private String clientId;

    @NotBlank
    private String clientSecret;
}
