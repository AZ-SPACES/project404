package com.aza.backend.dto.auth;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class TotpPendingResponse {
    @Builder.Default
    private boolean requires2FA = true;
    private String preAuthToken;
}
