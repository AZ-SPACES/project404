package com.aza.backend.websocket.controller;

import com.aza.backend.entity.User;
import com.aza.backend.service.PresenceService;
import com.aza.backend.service.WebSocketPublisher;
import com.aza.backend.websocket.interceptor.WebSocketAuthInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.Map;

@Controller
@RequiredArgsConstructor
public class WebSocketController {

    private final PresenceService presenceService;
    private final WebSocketPublisher webSocketPublisher;

    /**
     * Client sends a message to /app/heartbeat every ~30s.
     * Refreshes the user-level and device-level presence TTLs in Redis
     * and acknowledges on /user/queue/heartbeat.
     */
    @MessageMapping("/heartbeat")
    public void heartbeat(Principal principal, SimpMessageHeaderAccessor accessor) {
        User user = extractUser(principal);
        if (user != null) {
            presenceService.heartbeat(user.getId(), deviceSessionId(accessor));
            webSocketPublisher.sendToUser(user.getId().toString(), "/queue/heartbeat", "OK");
        }
    }

    private User extractUser(Principal principal) {
        if (principal instanceof UsernamePasswordAuthenticationToken auth
                && auth.getPrincipal() instanceof User user) {
            return user;
        }
        return null;
    }

    private String deviceSessionId(SimpMessageHeaderAccessor accessor) {
        Map<String, Object> attrs = accessor.getSessionAttributes();
        Object id = attrs != null ? attrs.get(WebSocketAuthInterceptor.DEVICE_SESSION_ATTR) : null;
        return id != null ? id.toString() : null;
    }
}
