package com.aza.backend.dto.transfer;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
@AllArgsConstructor
public class TransferResponse {
    private String id;
    private String senderId;
    private String senderName;
    private String recipientId;
    private String recipientName;
    private BigDecimal amount;
    private String currency;
    private String note;
    private String type;
    private String status;
    private String initiatedAt;
    private String completedAt;
}
