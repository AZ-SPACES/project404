package com.aza.backend.dto.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
public class StaffMemberResponse {
    private String userId;
    private String name;
    private String email;
    private String handle;
    private String profileImageUrl;
    private List<RoleGrant> roles;

    @Data
    @Builder
    @AllArgsConstructor
    public static class RoleGrant {
        private String role;
        private String grantedAt;
        private String grantedByEmail;
    }
}
