package com.aza.backend.dto.merchant;

import lombok.Builder;
import lombok.Data;

/**
 * Lightweight, non-sensitive view of an active merchant for public listings
 * (e.g. the "merchants on AZA" marquee on the marketing site).
 */
@Data
@Builder
public class PublicMerchantSummary {
    private String businessName;
    private String businessHandle;
    private String logoUrl;
    private String category;
    private String brandColor;
}
