package com.aza.backend.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class DisputeStatsResponse {
    private long open;
    private long underReview;
    private long resolvedThisMonth;
    private BigDecimal totalValueDisputed;
}
