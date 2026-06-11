package com.aza.backend.dto.user;

import lombok.Data;

@Data
public class PrivacySettingsRequest {
    private Boolean findMeByPhone;
    private Boolean findMeByEmail;
    private Boolean findMeByHandle;
    private Boolean syncContacts;
    private Boolean showOnlineStatus;
    private Boolean billForwardingEnabled;
    private Boolean biometricsEnabled;
    private Boolean passkeysEnabled;
}
