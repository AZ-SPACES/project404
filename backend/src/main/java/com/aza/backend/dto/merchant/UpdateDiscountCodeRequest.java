package com.aza.backend.dto.merchant;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class UpdateDiscountCodeRequest {

    private Boolean active;
    private Integer maxUses;
    private LocalDateTime expiresAt;
}
