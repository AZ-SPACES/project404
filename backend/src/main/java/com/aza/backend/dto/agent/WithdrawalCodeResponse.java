package com.aza.backend.dto.agent;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

/** Returned to the customer when a withdrawal code is generated. The plaintext code is shown only once. */
@Data
@Builder
public class WithdrawalCodeResponse {
    private String code;
    private BigDecimal amount;
    private BigDecimal estimatedFee;
    private String expiresAt;
    private String currency;
}
