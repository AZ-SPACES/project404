package com.aza.backend.dto.miniapp;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.Set;

@Data
public class SubmitMiniAppRequest {

    /** URL-safe slug: lowercase letters, digits, underscores. */
    @NotBlank
    @Pattern(regexp = "^[a-z0-9_]{3,100}$",
             message = "App ID must be 3-100 chars: lowercase letters, digits, underscores only")
    private String id;

    @NotBlank
    @Size(max = 80)
    private String name;

    @Size(max = 500)
    private String description;

    @NotBlank
    private String category;

    /** Icon image URL (hosted by the developer). Must use HTTPS if provided. */
    @Pattern(regexp = "^(https://.*)?$", message = "Icon URL must use HTTPS")
    private String iconUrl;

    /**
     * How this app is served. {@code EXTERNAL} (default) means the developer hosts the build
     * and supplies {@link #url}; {@code AZA_HOSTED} means they upload a bundle instead and Aza
     * assigns the URL.
     */
    @Pattern(regexp = "^(EXTERNAL|AZA_HOSTED)?$", message = "hostingMode must be EXTERNAL or AZA_HOSTED")
    private String hostingMode;

    /**
     * The URL the WebView will load. Must be HTTPS. Required for {@code EXTERNAL} apps and
     * ignored for {@code AZA_HOSTED} ones, where Aza derives it from the app id — validated in
     * MiniAppService rather than here, since the requirement depends on hostingMode.
     */
    @Pattern(regexp = "^(https://.*)?$", message = "App URL must use HTTPS")
    private String url;

    @NotBlank
    @Size(max = 100)
    private String developerName;

    @Pattern(regexp = "^(https://.*)?$", message = "Support URL must use HTTPS")
    private String supportUrl;

    @Size(max = 20)
    private String version;

    /** Which Aza permissions this app needs. */
    private Set<String> requestedPermissions;

    /** true = submit for review immediately; false = save as draft */
    private boolean submitForReview;
}
