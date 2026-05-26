package com.aza.backend.dto.merchant;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SubscriptionResponse {
    private String id;
    private String planId;
    private String merchantId;
    private String customerId;
    private String customerName;
    private String customerEmail;
    private String status;
    private LocalDateTime nextBillingAt;
    private LocalDateTime createdAt;
    private LocalDateTime cancelledAt;
}
