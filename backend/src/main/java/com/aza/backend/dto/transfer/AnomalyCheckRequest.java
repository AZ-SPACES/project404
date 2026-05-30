package com.aza.backend.dto.transfer;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class AnomalyCheckRequest {
    private String recipientIdentifier;
    private BigDecimal amount;
}
