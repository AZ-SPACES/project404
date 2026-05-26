package com.aza.backend.dto.contact;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SentContactRequestResponse {
    private String id;
    private String receiverUserId;
    private String receiverDisplayName;
    private String receiverUsername;
    private String receiverProfileImageUrl;
    private String status;
    private String createdAt;
}
