package com.aza.backend.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class TwoFactorPendingResponse {
    private String preAuthToken;
    private java.util.List<String> methods;
    private String defaultMethod;
}
