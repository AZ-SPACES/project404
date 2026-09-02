package com.aza.backend.websocket.handler;

import com.aza.backend.dto.chat.SendMessageRequest;
import com.aza.backend.dto.chat.TypingRequest;
import com.aza.backend.entity.User;
import com.aza.backend.service.ChatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Controller;

import java.security.Principal;

/**
 * Handles WebSocket messages sent via STOMP from the client.
 * Client sends to: /app/chat.send, /app/chat.typing, /app/chat.heartbeat
 * These complement the REST endpoints — REST for history/pagination,
 * WebSocket for real-time delivery.
 *
 * <p>The sender is read off the STOMP {@link Principal} rather than with
 * {@code @AuthenticationPrincipal}. That annotation only works on messaging
 * handlers when Spring Security's messaging module contributes its argument
 * resolver, and {@code spring-security-messaging} is not a dependency of this
 * service — with it absent the parameter silently fails to resolve, every frame
 * on these mappings dies before reaching {@link ChatService}, and the catch
 * blocks below hide it. {@code WebSocketAuthInterceptor} already puts the full
 * {@link User} on the session principal, so reading it directly is both
 * dependency-free and consistent with {@code WebSocketController}.
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
            Principal principal) {
        User user = extractUser(principal);
        if (user == null) {
            log.warn("Dropping chat.send from an unauthenticated STOMP session");
            return;
        }
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
            Principal principal) {
        User user = extractUser(principal);
        if (user == null) {
            log.warn("Dropping chat.typing from an unauthenticated STOMP session");
            return;
        }
        try {
            chatService.sendTypingIndicator(user, request);
        } catch (Exception e) {
            log.error("Typing indicator failed for user {}: {}",
                    user.getId(), e.getMessage());
        }
    }

    private User extractUser(Principal principal) {
        if (principal instanceof UsernamePasswordAuthenticationToken auth
                && auth.getPrincipal() instanceof User user) {
            return user;
        }
        return null;
    }
}
