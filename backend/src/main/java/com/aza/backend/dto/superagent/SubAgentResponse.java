package com.aza.backend.dto.superagent;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

/** One agent in the master's downline, as the roster and detail views show them. */
@Data
@Builder
public class SubAgentResponse {
    private String id;
    private String userId;
    private String code;
    private String status;
    private String userName;
    private String userPhone;
    private String location;
    private String businessName;
    private BigDecimal floatBalance;
    private BigDecimal floatLimit;
    /** Commission AZA owes this agent. Shown for oversight; the master never settles it. */
    private BigDecimal commissionAccruedGhs;
    /** Lifetime float this master has pushed down, minus what it has recalled. */
    private BigDecimal netFloatReceived;
    private String createdAt;
}
