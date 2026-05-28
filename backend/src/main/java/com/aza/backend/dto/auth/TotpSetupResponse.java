package com.aza.backend.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
public class TotpSetupResponse {
    private String secret;          // Base32 secret for manual entry
    private String qrCodeImage;     // Base64-encoded PNG — render directly, secret stays off third-party servers
    private List<String> recoveryCodes; // 8 one-time backup codes — shown only at setup
}
