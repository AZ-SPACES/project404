package com.aza.backend.dto.e2ee;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class KeyBundleResponse {
    private String recipientId;
    private String identityPublicKey;
    private String signedPreKeyPublic;
    private String signedPreKeySignature;
    private String oneTimePreKeyId;
    private String oneTimePreKeyPublic;
}
