package com.aza.backend.dto.merchant;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class PayoutRequest {

    @NotNull
    @DecimalMin("1.00")
    private BigDecimal amount;

    @NotBlank
    @Size(min = 4, max = 4, message = "Passcode must be exactly 4 digits")
    private String passcode;

    private String note;
}
