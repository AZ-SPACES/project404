package com.aza.backend.websocket.handler;

import com.aza.backend.dto.chat.SendMessageRequest;
import com.aza.backend.dto.chat.TypingRequest;
import com.aza.backend.entity.User;
import com.aza.backend.service.ChatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Controller;

/**
 * Handles WebSocket messages sent via STOMP from the client.
 * Client sends to: /app/chat.send, /app/chat.typing, /app/chat.heartbeat
 * These complement the REST endpoints — REST for history/pagination,
 * WebSocket for real-time delivery.
 */
@Controller
@RequiredArgsConstructor
@Slf4j
public class ChatWebSocketHandler {

    private final ChatService chatService;

    /**
     * Handle message sent over WebSocket.
     * Client sends: SEND /app/chat.send
     */
    @MessageMapping("/chat.send")
    public void handleMessage(
            @Payload SendMessageRequest request,
            @AuthenticationPrincipal User user) {
        try {
            chatService.sendMessage(user, request);
        } catch (Exception e) {
            log.error("WebSocket message send failed for user {}: {}",
                    user.getId(), e.getMessage());
        }
    }

    /**
     * Handle typing indicator over WebSocket.
     * Client sends: SEND /app/chat.typing
     */
    @MessageMapping("/chat.typing")
    public void handleTyping(
            @Payload TypingRequest request,
            @AuthenticationPrincipal User user) {
        try {
            chatService.sendTypingIndicator(user, request);
        } catch (Exception e) {
            log.error("Typing indicator failed for user {}: {}",
                    user.getId(), e.getMessage());
        }
    }
}
