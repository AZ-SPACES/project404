package com.aza.backend.dto.merchant;

import lombok.Data;

@Data
public class UpdateApiKeyRequest {
    private String label;
    private String ipWhitelist;
    private String scopes;
}
