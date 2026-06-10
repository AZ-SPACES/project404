package com.aza.backend.dto.oauth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class OAuthClientRegistrationRequest {

    @NotBlank
    @Size(max = 100)
    private String appName;

    @Size(max = 500)
    private String appDescription;

    @Size(max = 500)
    private String logoUrl;

    @Size(max = 500)
    private String websiteUrl;

    @NotEmpty
    private List<String> redirectUris;

    @NotEmpty
    private List<String> scopes;
}
