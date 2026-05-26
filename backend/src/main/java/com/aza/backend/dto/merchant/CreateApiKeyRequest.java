package com.aza.backend.dto.merchant;

import lombok.Data;

@Data
public class CreateApiKeyRequest {
    private String label;
    private String environment; // LIVE or TEST, defaults to LIVE
}
