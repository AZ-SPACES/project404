package com.aza.backend.dto.ai;

import lombok.Data;
import java.util.List;

@Data
public class AiChatRequest {
    private String message;
    private List<AiChatMessage> history;
}
