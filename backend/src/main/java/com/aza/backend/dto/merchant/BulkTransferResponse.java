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
public class BulkTransferResponse {

    private UUID id;
    private UUID merchantId;
    private String note;
    private BigDecimal totalAmount;
    private int recipientCount;
    private int successCount;
    private int failureCount;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime processedAt;
}
