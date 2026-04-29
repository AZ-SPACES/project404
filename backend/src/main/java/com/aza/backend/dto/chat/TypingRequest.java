package com.aza.backend.dto.chat;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class TypingRequest {

    @NotNull(message = "Chat ID is required")
    private UUID chatId;

    private boolean isTyping;
}
