package com.aza.backend.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class SupportNoteResponse {
    private String id;
    private String chatId;
    private String authorId;
    private String authorName;
    private String content;
    private LocalDateTime createdAt;
}
