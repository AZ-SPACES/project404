package com.aza.backend.dto.agent;

import lombok.Data;

@Data
public class CashOutRedeemRequest {
    private String code;
    private String idempotencyKey;
}
