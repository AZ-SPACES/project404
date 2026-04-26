package com.aza.backend.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class PublicProfileResponse {
    private String id;
    private String displayName;
    private String profileImageUrl;
    private String onlineStatus;
}
