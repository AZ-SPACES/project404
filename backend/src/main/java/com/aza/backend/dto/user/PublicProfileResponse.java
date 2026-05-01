package com.aza.backend.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PublicProfileResponse {
    private String id;
    private String displayName;
    private String handle;
    private String profileImageUrl;
    private String onlineStatus;
}
