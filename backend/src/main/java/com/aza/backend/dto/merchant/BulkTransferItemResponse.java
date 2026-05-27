package com.aza.backend.dto.merchant;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class BulkTransferItemResponse {

    private UUID id;
    private String recipientIdentifier;
    private BigDecimal amount;
    private String note;
    private String status;
    private String failureReason;
    private LocalDateTime processedAt;
}
