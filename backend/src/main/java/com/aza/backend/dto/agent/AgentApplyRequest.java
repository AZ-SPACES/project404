package com.aza.backend.dto.agent;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class AgentApplyRequest {
    private String location;
    private String businessName;
    private String contactPhone;
    private String idNumber;
    private BigDecimal expectedMonthlyVolumeGhs;
    private String applicationNotes;
}
