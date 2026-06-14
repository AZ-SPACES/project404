package com.aza.backend.dto.ai;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AiChatMessage {
    @Pattern(regexp = "user|assistant", message = "role must be 'user' or 'assistant'")
    private String role;

    @Size(max = 2000, message = "message content cannot exceed 2000 characters")
    private String content;
}
