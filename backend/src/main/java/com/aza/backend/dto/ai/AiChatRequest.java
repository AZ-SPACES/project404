package com.aza.backend.dto.ai;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.util.List;

@Data
public class AiChatRequest {
    @NotBlank(message = "message is required")
    @Size(max = 2000, message = "message cannot exceed 2000 characters")
    private String message;

    @Size(max = 20, message = "history cannot exceed 20 messages")
    private List<AiChatMessage> history;
}
