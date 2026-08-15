package com.aza.backend.dto.split;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

/**
 * Where two people stand once everything between them is netted off.
 */
@Data
@Builder
public class BalanceResponse {

    private String userId;
    private String name;
    private String handle;
    private String avatarUrl;

    /** What each of them owes the other before netting — shown so the maths is legible. */
    private BigDecimal theyOweYou;
    private BigDecimal youOweThem;

    /** The difference. Positive means they owe you; negative means you owe them. */
    private BigDecimal net;

    /** How many outstanding shares would be collapsed by settling up. */
    private Integer shareCount;

    /** An open settlement between the two of you, if one is already waiting. */
    private String openSettlementId;
}
