package com.aza.backend.dto.contact;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ContactRequestResponse {
    private String id;
    private String senderUserId;
    private String receiverUserId;
    private String status;
    private String senderDisplayName;
    private String senderUsername;
    private String senderProfileImageUrl;
    private String createdAt;
}
