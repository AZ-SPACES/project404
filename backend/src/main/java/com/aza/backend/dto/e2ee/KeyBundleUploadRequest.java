package com.aza.backend.dto.e2ee;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class KeyBundleUploadRequest {
    @NotBlank(message = "Identity public key is required")
    private String identityPublicKey;

    @NotBlank(message = "Signed pre-key public is required")
    private String signedPreKeyPublic;

    @NotBlank(message = "Signed pre-key signature is required")
    private String signedPreKeySignature;

    @NotEmpty(message = "At least one one-time pre-key is required")
    private List<OneTimePreKey> oneTimePreKeys;

    @Data
    public static class OneTimePreKey {
        private int keyId;
        private String publicKey;
    }
}
