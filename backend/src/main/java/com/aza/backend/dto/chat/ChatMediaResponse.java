package com.aza.backend.dto.chat;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ChatMediaResponse {
    private String mediaKey; // Cloudinary secure URL — pass as SendMessageRequest.mediaKey
    private String type;
    private String chatId;
}
