package com.aza.backend.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class AdminTransactionResponse {
    private String id;
    private String senderId;
    private String senderName;
    private String senderHandle;
    private String recipientId;
    private String recipientName;
    private String recipientHandle;
    private BigDecimal amount;
    private String note;
    private String type;
    private String status;
    private LocalDateTime initiatedAt;
    private LocalDateTime completedAt;
    private LocalDateTime cancelledAt;
    private String category;
    private Double anomalyScore;
    private String anomalyRiskLevel;
    private String direction; // "INCOMING" or "OUTGOING" relative to the requesting user
}
