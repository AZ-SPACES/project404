package com.aza.backend.dto.miniapp;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
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

    /** The URL the WebView will load. Must be HTTPS. */
    @NotBlank
    @Pattern(regexp = "^https://.*", message = "App URL must use HTTPS")
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

    /** Marketing screenshots (HTTPS image URLs) shown to admins during review. Up to 6. */
    @Size(max = 6, message = "At most 6 screenshots allowed")
    private List<@Pattern(regexp = "^https://.*", message = "Screenshot URLs must use HTTPS") String> screenshotUrls;

    /** true = submit for review immediately; false = save as draft */
    private boolean submitForReview;
}
