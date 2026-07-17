package com.aza.backend.dto.connect;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
public class ConnectTransferResponse {
    private UUID id;
    private String recipient;
    private UUID recipientUserId;
    private BigDecimal amount;
    private String currency;
    private String note;
    private String reference;
    private String status;
    private String failureReason;
    private Boolean testMode;
    private LocalDateTime createdAt;
    private LocalDateTime processedAt;
}
