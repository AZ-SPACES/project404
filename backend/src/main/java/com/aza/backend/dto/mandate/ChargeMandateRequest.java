package com.aza.backend.dto.mandate;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class ChargeMandateRequest {

    @NotNull
    @DecimalMin("0.01")
    private BigDecimal amount;

    @Size(max = 255)
    private String reference;
}
