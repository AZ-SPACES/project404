package com.aza.backend.dto.oauth;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class OAuthTokenRequest {

    @NotBlank
    private String grantType;      // "authorization_code" | "refresh_token"

    private String code;           // for authorization_code grant
    private String redirectUri;    // for authorization_code grant
    private String codeVerifier;   // PKCE verifier for authorization_code grant

    private String refreshToken;   // for refresh_token grant

    @NotBlank
    private String clientId;

    @NotBlank
    private String clientSecret;
}
