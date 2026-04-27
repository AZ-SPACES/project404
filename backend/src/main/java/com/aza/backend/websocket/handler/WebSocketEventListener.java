package com.aza.backend.websocket.handler;

import com.aza.backend.entity.User;
import com.aza.backend.service.PresenceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketEventListener {
    private final PresenceService presenceService;

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectedEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        User user = extractUser(accessor);
        if (user != null) {
            presenceService.setOnline(user.getId());
            log.info("WebSocket connected: userId={}, sessionId={}",
                    user.getId(), accessor.getSessionId());
        }
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        User user = extractUser(accessor);
        if (user != null) {
            presenceService.setOffline(user.getId());
            log.info("WebSocket disconnected: userId={}, sessionId={}",
                    user.getId(), accessor.getSessionId());
        }
    }

    private User extractUser(StompHeaderAccessor accessor) {
        if (accessor.getUser() instanceof UsernamePasswordAuthenticationToken auth) {
            if (auth.getPrincipal() instanceof User user) {
                return user;
            }
        }
        return null;
    }
}
