package com.aza.backend.dto.mandate;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class MandateChargeResponse {

    private UUID id;
    private UUID mandateId;
    private BigDecimal amount;
    private String status;
    private UUID transactionId;
    private String failureReason;
    private LocalDateTime createdAt;
}
