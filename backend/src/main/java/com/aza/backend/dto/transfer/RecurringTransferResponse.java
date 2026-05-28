package com.aza.backend.dto.transfer;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class RecurringTransferResponse {

    private UUID id;
    private String recipientIdentifier;
    private BigDecimal amount;
    private String note;
    private String frequency;
    private LocalDateTime nextRunAt;
    private String status;
    private int totalRuns;
    private int successfulRuns;
    private LocalDateTime lastRunAt;
    private String lastFailureReason;
    private LocalDateTime createdAt;
}
