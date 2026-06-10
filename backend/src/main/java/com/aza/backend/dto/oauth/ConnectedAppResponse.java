package com.aza.backend.dto.oauth;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ConnectedAppResponse {
    private String clientId;
    private String appName;
    private String appDescription;
    private String logoUrl;
    private String websiteUrl;
    private List<String> grantedScopes;
    private String grantedAt;
}
