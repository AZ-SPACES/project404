package com.aza.backend.dto.user;

import lombok.Data;

@Data
public class PrivacySettingsRequest {
    private Boolean findMeByPhone;
    private Boolean findMeByEmail;
}
