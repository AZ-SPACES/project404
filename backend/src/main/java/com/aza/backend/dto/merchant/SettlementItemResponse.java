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
public class SettlementItemResponse {

    private UUID id;
    private UUID checkoutSessionId;
    private BigDecimal amount;
    private BigDecimal fee;
    private BigDecimal net;
    private LocalDateTime transactionDate;
}
