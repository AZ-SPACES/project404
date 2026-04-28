package com.aza.backend.dto.chat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class MessageResponse {
    private String id;
    private String chatId;
    private String senderId;
    private String ciphertext;
    private String ephemeralKey;
    private String preKeyId;
    private String type;
    private String status;
    private String sentAt;
    private String deliveredAt;
    private String readAt;
    private boolean isDeleted;
    private String mediaKey;
}
