package com.aza.backend.dto.admin;

import lombok.Data;

import java.math.BigDecimal;

/** Mint/burn request: the amount and the safeguarded-account statement reference it ties to. */
@Data
public class FloatRequest {
    private BigDecimal amount;
    private String reference;
}
