package com.aza.backend.dto.oauth;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class OAuthAuthorizeRequest {

    @NotBlank
    private String clientId;

    @NotBlank
    private String redirectUri;

    @NotBlank
    private String scope;          // space-separated

    @NotBlank
    private String state;

    private String codeChallenge;       // PKCE
    private String codeChallengeMethod; // S256
}
