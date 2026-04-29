package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.chat.*;
import com.aza.backend.entity.User;
import com.aza.backend.service.ChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;
import jakarta.validation.constraints.Min;

@RestController
@RequestMapping("/api/v1/chats")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    /**
     * GET /api/v1/chats
     * List all conversations for the current user, most recent first.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<ChatResponse>>> listChats(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(chatService.listChats(user)));
    }

    /**
     * POST /api/v1/chats/{userId}
     * Get or create a 1:1 chat with another user.
     */
    @PostMapping("/{userId}")
    public ResponseEntity<ApiResponse<ChatResponse>> getOrCreateChat(
            @AuthenticationPrincipal User user,
            @PathVariable UUID userId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(chatService.getOrCreateChat(user, userId)));
    }

    /**
     * GET /api/v1/chats/{chatId}
     * Get a specific chat by ID.
     */
    @GetMapping("/{chatId}")
    public ResponseEntity<ApiResponse<ChatResponse>> getChat(
            @AuthenticationPrincipal User user,
            @PathVariable UUID chatId) {
        return ResponseEntity.ok(ApiResponse.success(chatService.getChat(user, chatId)));
    }

    /**
     * POST /api/v1/chats/messages
     * Send an encrypted message to a chat.
     */
    @PostMapping("/messages")
    public ResponseEntity<ApiResponse<MessageResponse>> sendMessage(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody SendMessageRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(chatService.sendMessage(user, request)));
    }

    /**
     * GET /api/v1/chats/{chatId}/messages
     * Get paginated message history for a chat.
     */
    @GetMapping("/{chatId}/messages")
    public ResponseEntity<ApiResponse<Page<MessageResponse>>> getMessages(
            @AuthenticationPrincipal User user,
            @PathVariable UUID chatId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                chatService.getMessages(user, chatId, page, size)));
    }

    /**
     * PUT /api/v1/chats/{chatId}/read
     * Mark all messages in a chat as read.
     */
    @PutMapping("/{chatId}/read")
    public ResponseEntity<ApiResponse<String>> markAsRead(
            @AuthenticationPrincipal User user,
            @PathVariable UUID chatId) {
        chatService.markAsRead(user, chatId);
        return ResponseEntity.ok(ApiResponse.success("Messages marked as read"));
    }

    /**
     * PUT /api/v1/chats/{chatId}/delivered
     * Mark all messages in a chat as delivered.
     */
    @PutMapping("/{chatId}/delivered")
    public ResponseEntity<ApiResponse<String>> markAsDelivered(
            @AuthenticationPrincipal User user,
            @PathVariable UUID chatId) {
        chatService.markAsDelivered(user, chatId);
        return ResponseEntity.ok(ApiResponse.success("Messages marked as delivered"));
    }

    /**
     * POST /api/v1/chats/typing
     * Send a typing indicator to the other participant.
     */
    @PostMapping("/typing")
    public ResponseEntity<ApiResponse<String>> sendTypingIndicator(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody TypingRequest request) {
        chatService.sendTypingIndicator(user, request);
        return ResponseEntity.ok(ApiResponse.success("Typing indicator sent"));
    }

    /**
     * DELETE /api/v1/chats/messages/{messageId}
     * Delete (unsend) a message.
     */
    @DeleteMapping("/messages/{messageId}")
    public ResponseEntity<ApiResponse<String>> deleteMessage(
            @AuthenticationPrincipal User user,
            @PathVariable UUID messageId) {
        chatService.deleteMessage(user, messageId);
        return ResponseEntity.ok(ApiResponse.success("Message deleted"));
    }

    /**
     * PUT /api/v1/chats/{chatId}/mute     *  or unmute a chat.
     */
    @PutMapping("/{chatId}/mute")
    public ResponseEntity<ApiResponse<String>> muteChat(
            @AuthenticationPrincipal User user,
            @PathVariable UUID chatId,
            @RequestParam boolean mute) {
        chatService.muteChat(user, chatId, mute);
        return ResponseEntity.ok(ApiResponse.success(
                mute ? "Chat muted" : "Chat unmuted"));
    }

    /**
     * PUT /api/v1/chats/{chatId}/archive     *  or unarchive a chat.
     */
    @PutMapping("/{chatId}/archive")
    public ResponseEntity<ApiResponse<String>> archiveChat(
            @AuthenticationPrincipal User user,
            @PathVariable UUID chatId,
            @RequestParam boolean archive) {
        chatService.archiveChat(user, chatId, archive);
        return ResponseEntity.ok(ApiResponse.success(
                archive ? "Chat archived" : "Chat unarchived"));
    }

    /**
     * GET /api/v1/chats/unread
     * Get total unread message count across all chats.
     */
    @GetMapping("/unread")
    public ResponseEntity<ApiResponse<Long>> getTotalUnreadCount(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(
                chatService.getTotalUnreadCount(user.getId())));
    }

    /**
     * PUT /api/v1/chats/{chatId}/disappearing
     * Enable or disable disappearing messages for a chat.
     * ttlSeconds=0 disables it. Common values: 86400 (24 h), 604800 (7 days), 7776000 (90 days).
     */
    @PutMapping("/{chatId}/disappearing")
    public ResponseEntity<ApiResponse<String>> setDisappearingMessages(
            @AuthenticationPrincipal User user,
            @PathVariable UUID chatId,
            @Valid @RequestBody DisappearingMessageRequest request) {
        chatService.setDisappearingMessages(user, chatId, request.getTtlSeconds());
        String msg = request.getTtlSeconds() == 0
                ? "Disappearing messages disabled"
                : "Disappearing messages set to " + request.getTtlSeconds() + " seconds";
        return ResponseEntity.ok(ApiResponse.success(msg));
    }

    /**
     * POST /api/v1/chats/messages/{messageId}/viewed
     * Mark a view-once media message as viewed.
     * The server wipes the mediaKey immediately — the media cannot be accessed again.
     */
    @PostMapping("/messages/{messageId}/viewed")
    public ResponseEntity<ApiResponse<MessageResponse>> markMediaViewed(
            @AuthenticationPrincipal User user,
            @PathVariable UUID messageId) {
        return ResponseEntity.ok(ApiResponse.success(
                chatService.markMediaViewed(user, messageId)));
    }

    /**
     * PUT /api/v1/chats/messages/{messageId}
     * Edit a sent text message (sender only, within 15 minutes of sending).
     */
    @PutMapping("/messages/{messageId}")
    public ResponseEntity<ApiResponse<MessageResponse>> editMessage(
            @AuthenticationPrincipal User user,
            @PathVariable UUID messageId,
            @Valid @RequestBody EditMessageRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                chatService.editMessage(user, messageId, request.getCiphertext())));
    }

    /**
     * POST /api/v1/chats/media/upload
     * Upload chat media (image, video, voice note, or document) to Cloudinary.
     * Returns a mediaKey (Cloudinary URL) to include in the subsequent SendMessageRequest.
     * Rate-limited to 20 uploads per hour per user.
     */
    @PostMapping(value = "/media/upload", consumes = "multipart/form-data")
    public ResponseEntity<ApiResponse<ChatMediaResponse>> uploadChatMedia(
            @AuthenticationPrincipal User user,
            @RequestParam("file") MultipartFile file,
            @Valid @ModelAttribute ChatMediaUploadRequest request) {
        ChatMediaResponse response = chatService.uploadChatMedia(
                user, file, request.getChatId(), request.getType());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }
}
