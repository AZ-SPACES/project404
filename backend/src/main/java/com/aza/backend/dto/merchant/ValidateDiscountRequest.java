package com.aza.backend.dto.merchant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class ValidateDiscountRequest {

    @NotBlank
    private String code;

    @NotNull
    private UUID merchantId;

    @NotNull
    @Positive
    private BigDecimal amount;
}
