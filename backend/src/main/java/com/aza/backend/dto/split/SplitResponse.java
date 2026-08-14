package com.aza.backend.dto.split;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class SplitResponse {

    private String id;
    private String description;
    private BigDecimal totalAmount;
    private String currency;
    private String splitMode;
    private String status;

    private String creatorId;
    private String creatorName;
    private String creatorHandle;
    private String creatorAvatarUrl;

    private LocalDateTime createdAt;
    private LocalDateTime settledAt;

    private Boolean organisedByMe;

    private BigDecimal myShare;
    private String myStatus;
    private String myRequestId;

    private BigDecimal outstandingAmount;
    private Integer paidCount;
    private Integer participantCount;

    private List<ParticipantInfo> participants;

    @Data
    @Builder
    public static class ParticipantInfo {
        private String userId;
        private String name;
        private String handle;
        private String avatarUrl;
        private BigDecimal amountOwed;
        private String status;
        private Boolean organiser;
        private String requestId;
        private LocalDateTime settledAt;
    }
}
