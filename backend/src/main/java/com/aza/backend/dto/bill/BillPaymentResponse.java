package com.aza.backend.dto.bill;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class BillPaymentResponse {

    private String id;
    private String billerSlug;
    private String billerName;
    private String billerLogoUrl;

    private String accountNumber;
    private String accountName;

    private BigDecimal amount;
    private String currency;

    /** PENDING, COMPLETED, REFUNDED, FAILED. */
    private String status;

    /** What the biller handed back — a prepaid meter token, a receipt number. */
    private String token;
    private String providerReference;
    private String failureReason;

    private LocalDateTime createdAt;
    private LocalDateTime completedAt;
}
