package com.aza.backend.dto.contact;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class BlockedUserResponse {
    private String blockedUserId;
    private String displayName;
    private String handle;
    private String profileImageUrl;
    private String blockedAt;
}
