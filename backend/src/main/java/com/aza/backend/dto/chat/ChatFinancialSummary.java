package com.aza.backend.dto.chat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
public class ChatFinancialSummary {
    private String chatId;
    private String otherUserId;
    private String currency;

    /** Total I paid out to fulfill their payment requests in this chat. */
    private BigDecimal totalPaidByMe;

    /** Total I received by having my payment requests fulfilled. */
    private BigDecimal totalReceivedByMe;

    /**
     * Net balance from my perspective.
     * Positive = they still owe me. Negative = I still owe them.
     */
    private BigDecimal netBalance;

    private long totalPaymentRequests;
    private long pendingPaymentRequests;
    private long paidPaymentRequests;

    /** Most recent payment requests in this chat (up to 10). */
    private List<PaymentActivityItem> recentActivity;

    @Data
    @Builder
    @AllArgsConstructor
    public static class PaymentActivityItem {
        private String id;
        private BigDecimal amount;
        private String currency;
        private String note;
        private String status;
        private boolean requestedByMe; // true = I sent the request
        private String createdAt;
        private String paidAt;
    }
}
