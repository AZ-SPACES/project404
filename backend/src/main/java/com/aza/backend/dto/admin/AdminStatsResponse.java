package com.aza.backend.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class AdminStatsResponse {
    private long totalUsers;
    private long activeUsers;
    private long suspendedUsers;
    private long deactivatedUsers;

    private long kycVerified;
    private long kycPendingReview;
    private long kycRejected;
    private long kycNotStarted;

    private long totalTransactions;
    private long completedTransactions;
    private BigDecimal totalTransactionVolume;
    private long transactionsToday;
    private BigDecimal volumeToday;

    private long totalMerchants;
    private long activeMerchants;
    private long pendingKybMerchants;
    private BigDecimal totalMerchantVolume;

    private BigDecimal totalWalletBalance;
    private BigDecimal totalMerchantBalance;
}
