package com.aza.backend.dto.oauth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class OAuthQrInitiateRequest {

    @NotBlank
    private String clientId;

    @NotBlank
    private String clientSecret;

    @NotEmpty
    private List<String> scopes;
}
