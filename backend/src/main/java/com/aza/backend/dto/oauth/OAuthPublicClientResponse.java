package com.aza.backend.dto.oauth;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class OAuthPublicClientResponse {
    private String clientId;
    private String appName;
    private String appDescription;
    private String logoUrl;
    private String websiteUrl;
    private List<String> allowedScopes;
}
