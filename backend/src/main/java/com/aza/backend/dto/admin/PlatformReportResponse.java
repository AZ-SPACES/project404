package com.aza.backend.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class PlatformReportResponse {
    private String period;
    private String startDate;
    private String endDate;
    private BigDecimal totalRevenue;
    private BigDecimal feeRevenue;
    private BigDecimal transactionVolume;
    private long transactionCount;
    private long newUsers;
    private long activeUsers;
    private long kycVerifications;
    private BigDecimal averageTransactionSize;
    private String topTransactionType;
}
