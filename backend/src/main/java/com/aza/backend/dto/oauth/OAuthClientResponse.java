package com.aza.backend.dto.oauth;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class OAuthClientResponse {
    private String id;
    private String clientId;
    private String clientSecret; // only present on create or rotate
    private String appName;
    private String appDescription;
    private String logoUrl;
    private String websiteUrl;
    private List<String> redirectUris;
    private List<String> allowedScopes;
    private boolean active;
    private String createdAt;
}
