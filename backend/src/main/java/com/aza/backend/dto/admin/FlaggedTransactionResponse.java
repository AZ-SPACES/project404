package com.aza.backend.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class FlaggedTransactionResponse {
    private String id;
    private String transactionId;
    private String userId;
    private String userName;
    private String userHandle;
    private BigDecimal amount;
    private String currency;
    private String flagReason;
    private int riskScore;
    private String status;
    private LocalDateTime flaggedAt;
    private LocalDateTime reviewedAt;
    private String reviewedBy;
    private String notes;
}
