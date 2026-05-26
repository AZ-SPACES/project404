package com.aza.backend.dto.merchant;

import lombok.Data;

@Data
public class RollApiKeyRequest {
    private Integer expirationHours; // grace period for the old key, defaults to 24
}
