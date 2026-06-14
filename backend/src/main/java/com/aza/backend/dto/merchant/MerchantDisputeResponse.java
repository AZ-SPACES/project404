package com.aza.backend.dto.merchant;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MerchantDisputeResponse {
    private String id;
    private String referenceId;
    private String transactionId;
    private BigDecimal amount;
    private String currency;
    private String category;
    private String description;
    private String status;
    private String merchantResponse;
    private LocalDateTime merchantRespondedAt;
    private LocalDateTime createdAt;
    private LocalDateTime resolvedAt;
}
