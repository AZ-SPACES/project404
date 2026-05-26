package com.aza.backend.dto.merchant;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiKeyResponse {

    private String id;
    private String label;
    private String keyPrefix; // shown in dashboard list
    private String fullKey;   // only set on creation, never returned again
    private String environment;
    private Boolean isActive;
    private LocalDateTime lastUsedAt;
    private LocalDateTime createdAt;
    private LocalDateTime revokedAt;
}
