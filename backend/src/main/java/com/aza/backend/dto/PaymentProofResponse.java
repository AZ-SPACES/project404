package com.aza.backend.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

/** Returned to the payer so they can render a verifiable "I paid this" QR code. */
@Data
@Builder
public class PaymentProofResponse {
    private String     transactionId;
    private String     reference;
    private BigDecimal amount;
    private String     currency;
    /** The full deep link to encode in the QR: https://aza.systems/p?ref=…&sig=… */
    private String     proofUrl;
    private String     signature;
}
