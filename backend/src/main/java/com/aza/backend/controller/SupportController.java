package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.chat.MessageResponse;
import com.aza.backend.entity.Chat;
import com.aza.backend.entity.User;
import com.aza.backend.service.SupportService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/support")
@RequiredArgsConstructor
public class SupportController {

    private final SupportService supportService;

    @PostMapping("/chat")
    public ResponseEntity<ApiResponse<Map<String, String>>> getOrCreateChat(
            @AuthenticationPrincipal User user) {
        Chat chat = supportService.getOrCreateSupportChat(user);
        return ResponseEntity.ok(ApiResponse.success(Map.of("chatId", chat.getId().toString())));
    }

    @GetMapping("/chat/messages")
    public ResponseEntity<ApiResponse<Page<MessageResponse>>> getMessages(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                supportService.getUserSupportMessages(user, page, size)));
    }

    @PostMapping("/chat/message")
    public ResponseEntity<ApiResponse<MessageResponse>> sendMessage(
            @AuthenticationPrincipal User user,
            @RequestBody SendSupportMessageRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                supportService.sendUserMessage(user, request.getContent())));
    }

    @PostMapping("/chat/message/attachment")
    public ResponseEntity<ApiResponse<MessageResponse>> sendAttachment(
            @AuthenticationPrincipal User user,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "caption", required = false) String caption) {
        return ResponseEntity.ok(ApiResponse.success(
                supportService.sendUserMediaMessage(user, file, caption)));
    }

    @GetMapping("/agents/available")
    public ResponseEntity<ApiResponse<List<SupportService.AgentStatus>>> getAvailableAgents() {
        return ResponseEntity.ok(ApiResponse.success(supportService.getAvailableAgents()));
    }

    @Data
    static class SendSupportMessageRequest {
        private String content;
    }
}
