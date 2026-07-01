package com.aza.backend.dto.connect;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class ConnectBalanceResponse {
    private BigDecimal available;
    private String currency;
}
