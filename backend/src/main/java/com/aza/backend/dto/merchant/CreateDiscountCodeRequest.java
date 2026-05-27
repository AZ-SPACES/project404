package com.aza.backend.dto.merchant;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class CreateDiscountCodeRequest {

    private String code; // optional — auto-generated if blank

    @NotNull
    private String discountType; // PERCENTAGE or FIXED

    @NotNull
    @Positive
    private BigDecimal value;

    private Integer maxUses;

    private LocalDateTime expiresAt;
}
