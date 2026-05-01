package com.aza.backend.dto.admin;

import lombok.Data;

@Data
public class BroadcastNotificationRequest {
    private String title;
    private String body;
    private String audience; // ALL | KYC_VERIFIED | ACTIVE_ONLY
}
