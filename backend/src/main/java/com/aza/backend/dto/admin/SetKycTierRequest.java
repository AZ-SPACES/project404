package com.aza.backend.dto.admin;

import lombok.Data;

@Data
public class SetKycTierRequest {
    private String tier; // TIER_1 | TIER_2 | TIER_3
}
