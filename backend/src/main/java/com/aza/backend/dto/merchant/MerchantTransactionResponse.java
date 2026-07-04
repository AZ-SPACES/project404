package com.aza.backend.dto.merchant;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * A transaction credited to the authenticated merchant's account, returned by
 * GET /api/v1/merchant/transactions/{id}. Used to verify a payment server-side —
 * e.g. confirming a Mini App SDK payment from the transactionId the SDK returns.
 */
@Data
@Builder
public class MerchantTransactionResponse {
    private String id;
    private String status;   // PENDING | COMPLETED | FAILED | CANCELLED | ...
    private BigDecimal amount;
    private String currency; // always GHS
    private String note;
    private String type;     // TRANSFER, etc.
    private LocalDateTime createdAt;
    private LocalDateTime completedAt;
}
