package com.aza.backend.dto.merchant;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/** The hold block returned on a manual-release checkout session. */
@Data
@Builder
public class HoldInfo {

    private String id;
    private String status;
    private BigDecimal amount;
    private BigDecimal releasedAmount;
    private BigDecimal refundedAmount;
    /** Still settleable: amount − released − refunded. */
    private BigDecimal remainingAmount;
    private BigDecimal azaFee;
    private LocalDateTime heldAt;
    private LocalDateTime expiresAt;
    private LocalDateTime resolvedAt;
    private List<HoldRecipientInfo> recipients;

    @Data
    @Builder
    public static class HoldRecipientInfo {
        private String recipient;
        private BigDecimal amount;
        private BigDecimal releasedAmount;
        private String status;
        private String failureReason;
    }
}
