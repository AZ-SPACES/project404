package com.aza.backend.dto.merchant;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class BalanceResponse {
    private BigDecimal balance;
    private String currency;
    private BigDecimal totalVolume;
}
