package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.chat.ChunkUploadRequest;
import com.aza.backend.dto.chat.HistoryTransferResponse;
import com.aza.backend.entity.ChatBackup;
import com.aza.backend.entity.HistoryTransfer;
import com.aza.backend.entity.User;
import com.aza.backend.service.HistorySyncService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * E2EE chat history sync: device-to-device transfers and encrypted backups.
 * Every payload that passes through here is encrypted client-side — the
 * server stores opaque blobs only.
 */
@RestController
@RequestMapping("/api/v1/chats/sync")
@RequiredArgsConstructor
public class HistorySyncController {

    private final HistorySyncService historySyncService;

    // ── Device-to-device transfers ───────────────────────────────────────────

    /** New device: ask the user's other devices for message history. */
    @PostMapping("/transfers")
    public ResponseEntity<ApiResponse<HistoryTransferResponse>> requestTransfer(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, String> body) {

        HistoryTransfer t = historySyncService.requestTransfer(user.getId(), body.get("deviceId"));
        return ResponseEntity.ok(ApiResponse.success(HistoryTransferResponse.from(t)));
    }

    /** Existing device: poll for history requests it can serve. */
    @GetMapping("/transfers/pending")
    public ResponseEntity<ApiResponse<List<HistoryTransferResponse>>> pendingTransfers(
            @AuthenticationPrincipal User user,
            @RequestParam String deviceId) {

        List<HistoryTransferResponse> pending = historySyncService
                .pendingTransfers(user.getId(), deviceId)
                .stream().map(HistoryTransferResponse::from).toList();
        return ResponseEntity.ok(ApiResponse.success(pending));
    }

    @GetMapping("/transfers/{id}")
    public ResponseEntity<ApiResponse<HistoryTransferResponse>> getTransfer(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {

        HistoryTransfer t = historySyncService.getTransfer(user.getId(), id);
        return ResponseEntity.ok(ApiResponse.success(HistoryTransferResponse.from(t)));
    }

    /** Existing device: claim a pending request before uploading. */
    @PostMapping("/transfers/{id}/accept")
    public ResponseEntity<ApiResponse<HistoryTransferResponse>> acceptTransfer(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id,
            @RequestBody Map<String, String> body) {

        HistoryTransfer t = historySyncService.acceptTransfer(user.getId(), id, body.get("deviceId"));
        return ResponseEntity.ok(ApiResponse.success(HistoryTransferResponse.from(t)));
    }

    @PostMapping("/transfers/{id}/decline")
    public ResponseEntity<ApiResponse<HistoryTransferResponse>> declineTransfer(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {

        HistoryTransfer t = historySyncService.declineTransfer(user.getId(), id);
        return ResponseEntity.ok(ApiResponse.success(HistoryTransferResponse.from(t)));
    }

    @PutMapping("/transfers/{id}/chunks")
    public ResponseEntity<ApiResponse<Map<String, Object>>> uploadTransferChunk(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id,
            @Valid @RequestBody ChunkUploadRequest request) {

        historySyncService.uploadTransferChunk(
                user.getId(), id, request.getDeviceId(), request.getSeq(), request.getPayload());
        return ResponseEntity.ok(ApiResponse.success(Map.of("seq", request.getSeq())));
    }

    @PostMapping("/transfers/{id}/complete")
    public ResponseEntity<ApiResponse<HistoryTransferResponse>> completeTransfer(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body) {

        String deviceId = String.valueOf(body.get("deviceId"));
        int chunkCount = Integer.parseInt(String.valueOf(body.get("chunkCount")));
        HistoryTransfer t = historySyncService
                .completeTransferUpload(user.getId(), id, deviceId, chunkCount);
        return ResponseEntity.ok(ApiResponse.success(HistoryTransferResponse.from(t)));
    }

    @GetMapping("/transfers/{id}/chunks/{seq}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> downloadTransferChunk(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id,
            @PathVariable int seq,
            @RequestParam String deviceId) {

        String payload = historySyncService
                .downloadTransferChunk(user.getId(), id, deviceId, seq);
        return ResponseEntity.ok(ApiResponse.success(Map.of("seq", seq, "payload", payload)));
    }

    /** New device confirms receipt — the server deletes the blobs immediately. */
    @PostMapping("/transfers/{id}/ack")
    public ResponseEntity<ApiResponse<Map<String, Object>>> ackTransfer(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id,
            @RequestBody Map<String, String> body) {

        historySyncService.ackTransfer(user.getId(), id, body.get("deviceId"));
        return ResponseEntity.ok(ApiResponse.success(Map.of("message", "Transfer completed")));
    }

    // ── Encrypted backups ────────────────────────────────────────────────────

    @PostMapping("/backup/begin")
    public ResponseEntity<ApiResponse<Map<String, Object>>> beginBackup(
            @AuthenticationPrincipal User user) {

        ChatBackup backup = historySyncService.beginBackup(user.getId());
        return ResponseEntity.ok(ApiResponse.success(Map.of("backupId", backup.getId())));
    }

    @PutMapping("/backup/{id}/chunks")
    public ResponseEntity<ApiResponse<Map<String, Object>>> uploadBackupChunk(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id,
            @Valid @RequestBody ChunkUploadRequest request) {

        historySyncService.uploadBackupChunk(user.getId(), id, request.getSeq(), request.getPayload());
        return ResponseEntity.ok(ApiResponse.success(Map.of("seq", request.getSeq())));
    }

    @PostMapping("/backup/{id}/complete")
    public ResponseEntity<ApiResponse<Map<String, Object>>> completeBackup(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body) {

        int chunkCount = Integer.parseInt(String.valueOf(body.get("chunkCount")));
        ChatBackup backup = historySyncService.completeBackup(user.getId(), id, chunkCount);
        return ResponseEntity.ok(ApiResponse.success(backupMeta(backup)));
    }

    /** Latest completed backup's metadata, or {exists:false}. */
    @GetMapping("/backup")
    public ResponseEntity<ApiResponse<Map<String, Object>>> latestBackup(
            @AuthenticationPrincipal User user) {

        ChatBackup backup = historySyncService.latestBackup(user.getId());
        if (backup == null) {
            return ResponseEntity.ok(ApiResponse.success(Map.of("exists", false)));
        }
        return ResponseEntity.ok(ApiResponse.success(backupMeta(backup)));
    }

    @GetMapping("/backup/{id}/chunks/{seq}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> downloadBackupChunk(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id,
            @PathVariable int seq) {

        String payload = historySyncService.downloadBackupChunk(user.getId(), id, seq);
        return ResponseEntity.ok(ApiResponse.success(Map.of("seq", seq, "payload", payload)));
    }

    @DeleteMapping("/backup")
    public ResponseEntity<ApiResponse<Map<String, Object>>> deleteBackup(
            @AuthenticationPrincipal User user) {

        historySyncService.deleteBackups(user.getId());
        return ResponseEntity.ok(ApiResponse.success(Map.of("message", "Backup deleted")));
    }

    private static Map<String, Object> backupMeta(ChatBackup backup) {
        Map<String, Object> meta = new HashMap<>();
        meta.put("exists", true);
        meta.put("backupId", backup.getId());
        meta.put("chunkCount", backup.getChunkCount());
        meta.put("sizeBytes", backup.getSizeBytes());
        meta.put("updatedAt", backup.getUpdatedAt());
        return meta;
    }
}
