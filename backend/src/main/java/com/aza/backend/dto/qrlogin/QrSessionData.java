package com.aza.backend.dto.qrlogin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QrSessionData {
    private String status;            // PENDING | APPROVED
    private String siteType;          // ADMIN | MERCHANT | DEVELOPER | THIRD_PARTY
    private String userId;            // null until approved
    private String sessionSecretHash; // SHA-256 of the secret returned to the initiating browser
    private long   expiresAtEpoch;    // seconds since epoch — used for accurate TTL recomputation
    private String oauthClientId;     // THIRD_PARTY only: the OAuth client_id
    private String oauthScopes;       // THIRD_PARTY only: comma-separated approved scopes
}
