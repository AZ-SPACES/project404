package com.aza.backend.dto.admin;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/** Limit-change request body; also serialized into pending approvals and replayed on approval. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserLimitsPayload {
    private BigDecimal dailyLimitGhs;
    private BigDecimal singleTransactionLimitGhs;
}
