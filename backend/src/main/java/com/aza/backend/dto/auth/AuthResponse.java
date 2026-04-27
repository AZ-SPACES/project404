package com.aza.backend.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class AuthResponse {
    private String accessToken;
    private String refreshToken;
    private String tokenType;
    private UserInfo user;

    @Data
    @Builder
    @AllArgsConstructor
    public static class UserInfo {
        private String id;
        private String email;
        private String phone;
        private String firstName;
        private String lastName;
        private String displayName;
        private String handle;
        private String profileImageUrl;
        private String kycStatus;
        private boolean passcodeSet;
    }
}
