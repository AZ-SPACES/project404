package com.aza.backend.dto.agent;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class GenerateWithdrawalCodeRequest {
    private BigDecimal amount;
}
