package com.aza.backend.dto.chat;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class DisappearingMessageRequest {

    /**
     * Seconds until messages disappear. Set to 0 to disable.
     * Common values: 86400 (24 h), 604800 (7 days), 7776000 (90 days).
     */
    @NotNull(message = "ttlSeconds is required")
    @Min(value = 0, message = "ttlSeconds must be 0 (off) or a positive duration in seconds")
    private Integer ttlSeconds;
}
