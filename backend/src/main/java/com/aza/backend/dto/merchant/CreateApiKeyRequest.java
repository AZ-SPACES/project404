package com.aza.backend.dto.merchant;

import lombok.Data;

@Data
public class CreateApiKeyRequest {
    private String label;
    private String environment; // LIVE or TEST, defaults to LIVE
    private String type; // SECRET or RESTRICTED, defaults to SECRET
    private String scopes; // comma-separated list of scopes
    private String ipWhitelist; // comma-separated list of IPs/CIDRs
    private Integer expirationDays; // optional days until auto-expiry
}
