package com.aza.backend.dto.merchant;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CheckoutSessionResponse {

    private String id;
    private String merchantId;
    private String merchantName;
    private String merchantHandle;
    private String merchantLogoUrl;
    private BigDecimal amount;
    private String currency;
    private String description;
    private String metadata;
    private String successUrl;
    private String cancelUrl;
    private String status;
    private String customerId;
    private BigDecimal platformFee;
    private BigDecimal netAmount;
    private String checkoutUrl;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;
    private LocalDateTime completedAt;
}
