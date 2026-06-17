package com.aza.backend.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

/** Public verification result for a scanned payment-proof QR. */
@Data
@Builder
public class PaymentVerifyResponse {
    private boolean    verified;
    private String     senderName;
    private String     recipientName;
    private BigDecimal amount;
    private String     currency;
    private String     status;
    private String     completedAt;
    private String     reference;
    private String     issuedBy;
}
