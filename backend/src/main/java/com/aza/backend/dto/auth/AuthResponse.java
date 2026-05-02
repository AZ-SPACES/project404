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
        private String firstName;
        private String lastName;
        private String displayName;
        private String handle;
        private String pronouns;
        private String profileImageUrl;
        private String kycStatus;
        private String role;
        private boolean passcodeSet;
        private String homeAddress;
        private String city;
        private String nationality;
        private String otherNationality;
        private Boolean isTaxResidentAbroad;
        private String taxCountry;
        private Boolean isUSPerson;
        // Privacy settings
        private Boolean findMeByPhone;
        private Boolean findMeByEmail;
        private Boolean findMeByHandle;
        private Boolean syncContacts;
        private Boolean billForwardingEnabled;
        // Security
        private Boolean twoFactorEnabled;
        private Boolean forcePasswordReset;
        private Boolean requireSelfieVerification;
        private String notificationPreferences;
    }
}
