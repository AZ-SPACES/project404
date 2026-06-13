package com.aza.backend.dto.miniapp;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SdkUserResponse {
    private String username;
    private String firstName;
    private String lastName;
    private String avatarUrl;
    private String phone;   // only if USER_PHONE granted
    private String email;   // only if USER_EMAIL granted
}
