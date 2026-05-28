package com.aza.backend.dto.auth;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class AccountRecoveryContactResponse {
    private UUID id;
    private String status; // PENDING | ACTIVE
    // Their profile (contact side)
    private UUID contactUserId;
    private String contactName;
    private String contactHandle;
    private String contactAvatarUrl;
    // Only present in the acceptInvitation response — store securely on device, never re-sent
    private String totpSecret;
}
