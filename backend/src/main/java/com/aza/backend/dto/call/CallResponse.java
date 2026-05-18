package com.aza.backend.dto.call;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class CallResponse {
    private String callId;
    private String callerId;
    private String callerName;
    private String callerAvatar;
    private String calleeId;
    private String calleeName;
    private String calleeAvatar;
    private String type;               // VOICE or VIDEO
    private String status;             // INITIATING, RINGING, ACTIVE, RECONNECTING, ENDED, ...
    private String initiatedAt;
    private String answeredAt;
    private String endedAt;
    private Integer durationSeconds;
    private Boolean upgradeRequested;  // true while a VOICE→VIDEO upgrade is pending
    private String upgradeRequestedBy; // userId who requested the upgrade
}
