package com.aza.backend.dto.merchant;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DiscountCodeResponse {

    private UUID id;
    private String code;
    private String discountType;
    private BigDecimal value;
    private Integer maxUses;
    private int usedCount;
    private LocalDateTime expiresAt;
    private boolean active;
    private LocalDateTime createdAt;
}
