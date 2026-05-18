package com.aza.backend.dto.admin;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class LiveStatsResponse {
    private long onlineUsers;
    private long transactionsLastHour;
    private long pendingKycCount;
}
