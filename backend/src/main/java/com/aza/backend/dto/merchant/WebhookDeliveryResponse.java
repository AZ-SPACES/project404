package com.aza.backend.dto.merchant;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class WebhookDeliveryResponse {
    private String id;
    private String eventType;
    private String status;
    private Integer httpStatus;
    private Integer attemptNumber;
    private LocalDateTime createdAt;
    private LocalDateTime nextRetryAt;
}
