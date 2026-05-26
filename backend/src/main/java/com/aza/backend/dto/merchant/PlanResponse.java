package com.aza.backend.dto.merchant;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PlanResponse {
    private String id;
    private String name;
    private String description;
    private BigDecimal amount;
    private String currency;
    private String interval;
    private boolean active;
    private LocalDateTime createdAt;
}
