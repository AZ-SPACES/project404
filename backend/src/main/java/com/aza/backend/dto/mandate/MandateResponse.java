package com.aza.backend.dto.mandate;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class MandateResponse {

    private UUID id;
    private UUID merchantId;
    private String merchantName;
    private String merchantLogoUrl;
    private BigDecimal perChargeLimit;
    private BigDecimal periodLimit;
    private String periodType;
    private BigDecimal periodSpent;
    private LocalDateTime periodResetAt;
    private LocalDateTime expiresAt;
    private String reference;
    private String status;
    private String sourceType;
    private String sourceId;
    private LocalDateTime lastChargedAt;
    private LocalDateTime approvedAt;
    private LocalDateTime createdAt;
}
