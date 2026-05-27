package com.aza.backend.dto.merchant;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class NotificationPreferenceResponse {

    private boolean emailPaymentReceived;
    private boolean emailDisputeOpened;
    private boolean emailPayoutCompleted;
    private boolean emailPayoutFailed;
    private boolean emailInvoicePaid;
    private boolean emailWeeklySummary;
    private boolean emailApiKeyCreated;
    private boolean emailLowBalance;
    private BigDecimal lowBalanceThreshold;
    private LocalDateTime updatedAt;
}
