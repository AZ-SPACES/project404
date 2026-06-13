package com.aza.backend.dto.miniapp;

import lombok.Builder;
import lombok.Data;

import java.util.Set;

/** Public view of a mini app returned to the mobile hub. */
@Data
@Builder
public class MiniAppRegistryEntry {
    private String id;
    private String name;
    private String description;
    private String category;
    private String iconUrl;
    private String url;
    private String developerName;
    private String version;
    private Set<String> requestedPermissions;
}
