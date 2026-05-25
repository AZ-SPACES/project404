package com.aza.backend.dto.merchant;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class PayoutRequest {

    @NotNull
    @DecimalMin("1.00")
    private BigDecimal amount;

    @NotBlank
    private String passcode;

    private String note;
}
