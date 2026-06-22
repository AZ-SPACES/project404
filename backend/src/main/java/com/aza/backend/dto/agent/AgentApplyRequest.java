package com.aza.backend.dto.agent;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class AgentApplyRequest {
    private String location;

    @NotBlank(message = "Business name is required")
    private String businessName;
    private String contactPhone;
    private String idNumber;
    private BigDecimal expectedMonthlyVolumeGhs;
    private String applicationNotes;
}
