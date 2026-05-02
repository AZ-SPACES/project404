package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.CannedResponseDto;
import com.aza.backend.dto.admin.SupportAnalyticsResponse;
import com.aza.backend.dto.admin.SupportNoteResponse;
import com.aza.backend.dto.chat.MessageResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.AdminSupportExtensionService;
import com.aza.backend.service.SupportService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/support")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminSupportController {

    private final SupportService supportService;
    private final AdminSupportExtensionService extensionService;

    // ── Existing endpoints ────────────────────────────────────────────────────

    @GetMapping("/chats")
    public ResponseEntity<ApiResponse<Page<SupportService.SupportChatSummary>>> listChats(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success(
                supportService.listAllSupportChats(page, size, status)));
    }

    @GetMapping("/chats/{chatId}")
    public ResponseEntity<ApiResponse<SupportService.SupportChatSummary>> getChatSummary(
            @PathVariable UUID chatId) {
        return ResponseEntity.ok(ApiResponse.success(
                supportService.getSupportChatSummary(chatId)));
    }

    @GetMapping("/chats/{chatId}/messages")
    public ResponseEntity<ApiResponse<Page<MessageResponse>>> getChatMessages(
            @AuthenticationPrincipal User agent,
            @PathVariable UUID chatId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                supportService.getChatMessages(chatId, agent.getId(), page, size)));
    }

    @PostMapping("/chats/{chatId}/reply")
    public ResponseEntity<ApiResponse<MessageResponse>> reply(
            @AuthenticationPrincipal User agent,
            @PathVariable UUID chatId,
            @RequestBody ReplyRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                supportService.replyToChat(agent, chatId, request.getContent())));
    }

    @PostMapping("/chats/{chatId}/resolve")
    public ResponseEntity<ApiResponse<SupportService.SupportChatSummary>> resolveChat(
            @PathVariable UUID chatId,
            @AuthenticationPrincipal User agent) {
        return ResponseEntity.ok(ApiResponse.success(supportService.resolveChat(chatId, agent)));
    }

    @PostMapping("/chats/{chatId}/reopen")
    public ResponseEntity<ApiResponse<SupportService.SupportChatSummary>> reopenChat(
            @PathVariable UUID chatId) {
        return ResponseEntity.ok(ApiResponse.success(supportService.reopenChat(chatId)));
    }

    @PatchMapping("/chats/{chatId}/priority")
    public ResponseEntity<ApiResponse<SupportService.SupportChatSummary>> updatePriority(
            @PathVariable UUID chatId,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(ApiResponse.success(supportService.updatePriority(chatId, body.get("priority"))));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Long>>> getStats() {
        return ResponseEntity.ok(ApiResponse.success(supportService.getSupportStats()));
    }

    @GetMapping("/agents/available")
    public ResponseEntity<ApiResponse<List<SupportService.AgentStatus>>> getAvailableAgents() {
        return ResponseEntity.ok(ApiResponse.success(supportService.getAvailableAgents()));
    }

    // ── Category update ───────────────────────────────────────────────────────

    @PatchMapping("/chats/{chatId}/category")
    public ResponseEntity<ApiResponse<SupportService.SupportChatSummary>> updateCategory(
            @PathVariable UUID chatId,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(ApiResponse.success(supportService.updateCategory(chatId, body.get("category"))));
    }

    // ── Internal Notes ────────────────────────────────────────────────────────

    @GetMapping("/chats/{chatId}/notes")
    public ResponseEntity<ApiResponse<List<SupportNoteResponse>>> getNotes(@PathVariable UUID chatId) {
        return ResponseEntity.ok(ApiResponse.success(extensionService.getNotes(chatId)));
    }

    @PostMapping("/chats/{chatId}/notes")
    public ResponseEntity<ApiResponse<SupportNoteResponse>> addNote(
            @AuthenticationPrincipal User agent,
            @PathVariable UUID chatId,
            @RequestBody NoteRequest request) {
        return ResponseEntity.ok(ApiResponse.success(extensionService.addNote(agent, chatId, request.getContent())));
    }

    // ── Canned Responses ──────────────────────────────────────────────────────

    @GetMapping("/canned-responses")
    public ResponseEntity<ApiResponse<List<CannedResponseDto>>> getCannedResponses() {
        return ResponseEntity.ok(ApiResponse.success(extensionService.getCannedResponses()));
    }

    @PostMapping("/canned-responses")
    public ResponseEntity<ApiResponse<CannedResponseDto>> createCannedResponse(
            @AuthenticationPrincipal User agent,
            @RequestBody CannedResponseRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                extensionService.createCannedResponse(agent, request.getTitle(), request.getContent(), request.getCategory())));
    }

    @DeleteMapping("/canned-responses/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteCannedResponse(@PathVariable UUID id) {
        extensionService.deleteCannedResponse(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    // ── Support Analytics ─────────────────────────────────────────────────────

    @GetMapping("/analytics")
    public ResponseEntity<ApiResponse<SupportAnalyticsResponse>> getAnalytics() {
        return ResponseEntity.ok(ApiResponse.success(extensionService.getAnalytics()));
    }

    // ── Request body inner classes ────────────────────────────────────────────

    @Data
    static class ReplyRequest { private String content; }

    @Data
    static class NoteRequest { private String content; }

    @Data
    static class CannedResponseRequest {
        private String title;
        private String content;
        private String category;
    }
}
