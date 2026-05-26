package com.aza.backend.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class MerchantStatsResponse {
    private long total;
    private long active;
    private long pendingKyb;
    private long kybSubmitted;
    private long kybUnderReview;
    private long moreInfoRequired;
    private long suspended;
    private long rejected;
    private BigDecimal totalBalance;
    private BigDecimal totalVolume;
}
