package com.aza.backend.dto.contact;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor

public class ContactResponse {
    private String id;
    private String contactUserId;
    private String displayName;
    private String phoneNumber;
    private String email;
    private boolean isAzaUser;
    private boolean isFavorite;
    private String profileImageUrl;
    private String handle;
}
