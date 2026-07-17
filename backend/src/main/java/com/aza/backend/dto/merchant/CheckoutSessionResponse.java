package com.aza.backend.dto.merchant;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CheckoutSessionResponse {

    private String id;
    private String merchantId;
    private String merchantName;
    private String merchantHandle;
    private String merchantLogoUrl;
    private String merchantBrandColor;
    private String merchantCheckoutTagline;
    private String merchantSupportEmail;
    private BigDecimal amount;
    private String currency;
    private String description;
    private String metadata;
    private String reference;
    private String successUrl;
    private String cancelUrl;
    private String status;
    private Boolean testMode; // true for sandbox sessions created with an aza_test_ key
    private String customerId;
    private BigDecimal platformFee;
    private BigDecimal netAmount;
    // Marketplace splits (Aza Connect). Merchant-facing only — never exposed on the
    // public checkout page, so buyers can't see who the sellers are.
    private List<CheckoutSplitInfo> splits;
    private BigDecimal taxAmount;
    private String taxLabel;
    private String checkoutUrl;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;
    private LocalDateTime completedAt;
    private LocalDateTime cancelledAt;
    private LocalDateTime refundedAt;
}
