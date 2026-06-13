package com.aza.backend.dto.miniapp;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class SdkPaymentResponse {
    private String transactionId;
    private String status;       // PENDING | COMPLETED | FAILED
    private BigDecimal amount;
    private String recipientUsername;
    private String note;
}
