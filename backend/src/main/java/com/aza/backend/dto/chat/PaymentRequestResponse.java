package com.aza.backend.dto.chat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
@AllArgsConstructor
public class PaymentRequestResponse {
    private String id;
    private String chatId;
    private String requesterId;
    private String payerId;
    private BigDecimal amount;
    private String currency;
    private String note;
    private String status;       // PENDING, PAID, DECLINED, EXPIRED, CANCELLED
    private String transactionId; // set when PAID
    private String expiresAt;
    private String paidAt;
    private String declinedAt;
    private String cancelledAt;
    private String createdAt;
}
