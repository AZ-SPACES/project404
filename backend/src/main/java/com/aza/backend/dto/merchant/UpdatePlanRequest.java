package com.aza.backend.dto.merchant;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpdatePlanRequest {
    private String name;
    private String description;
    private BigDecimal amount;
    private String interval;
}
