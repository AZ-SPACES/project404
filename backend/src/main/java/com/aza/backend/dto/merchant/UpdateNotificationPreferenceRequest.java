package com.aza.backend.dto.merchant;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpdateNotificationPreferenceRequest {

    private Boolean emailPaymentReceived;
    private Boolean emailDisputeOpened;
    private Boolean emailPayoutCompleted;
    private Boolean emailPayoutFailed;
    private Boolean emailInvoicePaid;
    private Boolean emailWeeklySummary;
    private Boolean emailApiKeyCreated;
    private Boolean emailLowBalance;
    private BigDecimal lowBalanceThreshold;
}
