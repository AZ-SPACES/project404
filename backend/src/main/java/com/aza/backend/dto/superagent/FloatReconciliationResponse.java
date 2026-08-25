package com.aza.backend.dto.superagent;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * Float position across the downline.
 *
 * <p>{@code variance} is {@code heldFloat - netDistributed} per agent: what the sub-agent
 * actually holds against what this master has net-pushed to them. It is expected to be
 * non-zero in normal trading — cash-in spends float and cash-out replenishes it — so this
 * is an operational view, not the safeguarding reconciliation, which lives in finance.
 */
@Data
@Builder
public class FloatReconciliationResponse {
    private BigDecimal masterFloat;
    private BigDecimal downlineFloat;
    private BigDecimal netDistributed;
    private BigDecimal variance;
    private String currency;
    private List<Row> rows;

    @Data
    @Builder
    public static class Row {
        private String subAgentId;
        private String code;
        private String userName;
        private String status;
        private BigDecimal heldFloat;
        private BigDecimal netDistributed;
        private BigDecimal variance;
    }
}
