package com.aza.backend.dto.merchant;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PayoutResponse {

    private String id;
    private BigDecimal amount;
    private String currency;
    private String status;
    private String note;
    private LocalDateTime requestedAt;
    private LocalDateTime completedAt;
}
