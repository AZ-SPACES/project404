package com.aza.backend.dto.merchant;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

/** Return held money to the payer. Omit {@code amount} for everything still held. */
@Data
public class RefundHoldRequest {

    @DecimalMin("0.01")
    private BigDecimal amount;

    @Size(max = 500)
    private String reason;
}
