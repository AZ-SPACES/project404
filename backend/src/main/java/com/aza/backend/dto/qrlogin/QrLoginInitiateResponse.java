package com.aza.backend.dto.qrlogin;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class QrLoginInitiateResponse {
    private String challengeToken;
    private String sessionSecret;  // caller must present this at /complete — never in the QR code
    private String qrImageBase64;
    private String expiresAt;
    private long ttlSeconds;
}
