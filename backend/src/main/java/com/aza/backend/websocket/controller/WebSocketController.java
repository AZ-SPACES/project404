package com.aza.backend.websocket.controller;

import com.aza.backend.entity.User;
import com.aza.backend.service.PresenceService;
import com.aza.backend.service.WebSocketPublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
@RequiredArgsConstructor
public class WebSocketController {

    private final PresenceService presenceService;
    private final WebSocketPublisher webSocketPublisher;

    /**
     * Client sends a message to /app/heartbeat every ~30s.
     * Refreshes the Redis presence TTL and acknowledges on /user/queue/heartbeat.
     */
    @MessageMapping("/heartbeat")
    public void heartbeat(Principal principal) {
        User user = extractUser(principal);
        if (user != null) {
            presenceService.heartbeat(user.getId());
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
}
