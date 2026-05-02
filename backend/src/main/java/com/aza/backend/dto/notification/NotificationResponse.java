package com.aza.backend.dto.notification;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class NotificationResponse {
    private String id;
    private String type;
    private String title;
    private String body;
    private String data;
    private String imageUrl;
    private boolean isRead;
    private String createdAt;
}
