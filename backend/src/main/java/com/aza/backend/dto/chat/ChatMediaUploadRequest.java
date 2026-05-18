package com.aza.backend.dto.chat;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

import java.util.UUID;

@Data
public class ChatMediaUploadRequest {

    @NotNull(message = "Chat ID is required")
    private UUID chatId;

    @NotBlank(message = "Media type is required")
    @Pattern(regexp = "IMAGE|VIDEO|VOICE_NOTE|DOCUMENT", message = "Type must be IMAGE, VIDEO, VOICE_NOTE, or DOCUMENT")
    private String type;
}
