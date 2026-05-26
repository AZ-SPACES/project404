package com.aza.backend.dto.merchant;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class CreatePlanRequest {
    @NotBlank
    private String name;
    private String description;
    @NotNull
    @DecimalMin("0.01")
    private BigDecimal amount;
    @NotNull
    private String interval;
}
