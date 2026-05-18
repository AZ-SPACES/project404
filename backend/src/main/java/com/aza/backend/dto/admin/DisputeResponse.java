package com.aza.backend.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class DisputeResponse {
    private String id;
    private String referenceId;
    private String transactionId;
    private String userId;
    private String userName;
    private String userHandle;
    private BigDecimal amount;
    private String currency;
    private String category;
    private String description;
    private String evidence;
    private String status;
    private String resolution;
    private LocalDateTime createdAt;
    private LocalDateTime resolvedAt;
}
