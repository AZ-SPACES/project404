package com.aza.backend.dto.chat;

import com.aza.backend.entity.HistoryTransfer;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
public class HistoryTransferResponse {

    private UUID id;
    private String status;
    private String requestingDeviceId;
    private String sourceDeviceId;
    private Integer chunkCount;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;

    public static HistoryTransferResponse from(HistoryTransfer t) {
        return HistoryTransferResponse.builder()
                .id(t.getId())
                .status(t.getStatus().name())
                .requestingDeviceId(t.getRequestingDeviceId())
                .sourceDeviceId(t.getSourceDeviceId())
                .chunkCount(t.getChunkCount())
                .createdAt(t.getCreatedAt())
                .expiresAt(t.getExpiresAt())
                .build();
    }
}
