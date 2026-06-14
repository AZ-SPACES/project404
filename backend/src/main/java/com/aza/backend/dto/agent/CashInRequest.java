package com.aza.backend.dto.agent;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class CashInRequest {
    private String customerIdentifier;
    private BigDecimal amount;
    private String idempotencyKey;
}
