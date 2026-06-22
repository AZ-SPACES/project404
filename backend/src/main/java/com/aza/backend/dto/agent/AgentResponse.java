package com.aza.backend.dto.agent;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

/** Agent record for the apply result and the admin queue. */
@Data
@Builder
public class AgentResponse {
    private String id;
    private String userId;
    /** Applicant identity, so the back office can review who is being approved. */
    private String userName;
    private String userEmail;
    private String userPhone;
    private String status;
    private String tier;
    private String code;
    private String location;
    private String businessName;
    private String contactPhone;
    private String idNumber;
    private BigDecimal expectedMonthlyVolumeGhs;
    private String applicationNotes;
    private BigDecimal floatBalance;
    private BigDecimal commissionAccruedGhs;
    /** Current commercial/risk terms, so the back office can review before editing. */
    private BigDecimal floatLimit;
    private Integer cashInCommissionBps;
    private Integer cashOutCommissionShareBps;
    private String createdAt;
}
