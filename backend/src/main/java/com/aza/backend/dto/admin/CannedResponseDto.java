package com.aza.backend.dto.admin;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class CannedResponseDto {
    private String id;
    private String title;
    private String content;
    private String category;
    private int usageCount;
    private LocalDateTime createdAt;
}
