package com.aza.backend.dto.superagent;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;

/**
 * Nominates an existing AZA user as a sub-agent under the calling master. Creates the agent
 * record in PENDING with the parent already set; activation still runs through the staff
 * maker-checker flow, so a master agent can never put its own recruit live.
 */
@Data
public class InviteSubAgentRequest {
    /** Email, phone or @username of the user being nominated. */
    @NotBlank(message = "A user identifier is required")
    private String identifier;

    @NotBlank(message = "Business name is required")
    private String businessName;

    private String location;
    private String contactPhone;
    private String idNumber;
    private BigDecimal expectedMonthlyVolumeGhs;
    private String applicationNotes;
}
