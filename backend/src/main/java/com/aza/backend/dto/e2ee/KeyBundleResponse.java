package com.aza.backend.dto.e2ee;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class KeyBundleResponse {
    private String recipientId;
    private String deviceId;
    private String identityPublicKey;
    /** Backend uses the legacy typo field name for compat; both spellings are set. */
    private String signedPreKyPublic;
    private String signedPreKeyPublic;
    private String signedPreKeySignature;
    private String oneTimePreKeyId;
    private String oneTimePreKeyPublic;
}
