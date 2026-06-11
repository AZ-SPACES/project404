package com.aza.backend.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
public class PresenceResponse {
    /** "ONLINE" or "OFFLINE". */
    private String status;
    /** Last activity timestamp — null if the user has never been seen online. */
    private LocalDateTime lastSeenAt;
}
