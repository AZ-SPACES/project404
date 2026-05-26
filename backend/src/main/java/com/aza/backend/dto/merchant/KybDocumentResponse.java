package com.aza.backend.dto.merchant;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class KybDocumentResponse {

    private String id;
    private String type;
    private String fileName;
    private String url;
    private Long fileSizeBytes;
    private String mimeType;
    private LocalDateTime uploadedAt;
}
