package com.aza.backend.dto.merchant;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SettlementResponse {

    private UUID id;
    private UUID merchantId;
    private UUID payoutId;
    private BigDecimal grossAmount;
    private BigDecimal feeTotal;
    private BigDecimal netAmount;
    private int transactionCount;
    private LocalDateTime periodStart;
    private LocalDateTime periodEnd;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime settledAt;
}
