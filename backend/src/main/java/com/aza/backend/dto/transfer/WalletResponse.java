package com.aza.backend.dto.transfer;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
@AllArgsConstructor
public class WalletResponse {
    private BigDecimal balance;
    private String currency;
    private String lastUpdatedAt;
}
