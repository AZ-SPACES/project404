package com.aza.backend.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class TotpSetupResponse {
    private String secret;   // Base32 secret — user should store this as a backup code
    private String qrUri;    // otpauth:// URI — encode as QR on the client
}
