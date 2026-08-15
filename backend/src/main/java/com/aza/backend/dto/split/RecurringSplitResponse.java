package com.aza.backend.dto.split;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class RecurringSplitResponse {

    private String id;
    private String description;
    private BigDecimal totalAmount;
    private String currency;
    private String splitMode;

    /** WEEKLY or MONTHLY. */
    private String frequency;
    /** Day of the week for WEEKLY, day of the month for MONTHLY. */
    private Integer dayOfPeriod;

    private LocalDate nextRunOn;
    private LocalDate lastRunOn;
    private Boolean active;

    private List<ParticipantInfo> participants;

    @Data
    @Builder
    public static class ParticipantInfo {
        private String userId;
        private String name;
        private String handle;
        private String avatarUrl;
        /** Whichever of these the split mode actually reads. */
        private BigDecimal amount;
        private Integer shares;
        private BigDecimal percentage;
    }
}
