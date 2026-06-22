package com.aza.backend.dto.agent;

import lombok.Data;

import java.math.BigDecimal;

/** Commission payout request: the amount to settle and the bank disbursement reference. */
@Data
public class SettleCommissionRequest {
    private BigDecimal amount;
    private String reference;
}
