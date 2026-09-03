package com.aza.backend.websocket.controller;

import com.aza.backend.dto.websocket.ResyncRequest;
import com.aza.backend.dto.websocket.WebSocketEventType;
import com.aza.backend.dto.websocket.WebSocketMessage;
import com.aza.backend.entity.User;
import com.aza.backend.service.PresenceService;
import com.aza.backend.service.WebSocketEventLog;
import com.aza.backend.service.WebSocketPublisher;
import com.aza.backend.websocket.interceptor.WebSocketAuthInterceptor;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

@Controller
@RequiredArgsConstructor
@Slf4j
public class WebSocketController {

    /**
     * Queues that carry durable events and so can be replayed. Presence and call
     * signaling are deliberately absent — they are never logged, because a
     * replayed presence flag or SDP offer is stale by the time it lands.
     */
    private static final Set<String> REPLAYABLE_DESTS =
            Set.of(WebSocketPublisher.DEST_CHAT, WebSocketPublisher.DEST_NOTIFICATIONS);

    private final PresenceService presenceService;
    private final WebSocketPublisher webSocketPublisher;
    private final WebSocketEventLog eventLog;
    private final ObjectMapper objectMapper;

    /**
     * Client sends a message to /app/heartbeat every ~30s.
     * Refreshes the user-level and device-level presence TTLs in Redis
     * and acknowledges on /user/queue/heartbeat.
     */
    @MessageMapping("/heartbeat")
    public void heartbeat(Principal principal, SimpMessageHeaderAccessor accessor) {
        User user = extractUser(principal);
        if (user != null) {
            presenceService.heartbeat(
                    user.getId(), accessor.getSessionId(), deviceSessionId(accessor));
            webSocketPublisher.sendToUser(user.getId().toString(), "/queue/heartbeat", "OK");
        }
    }

    /**
     * Client sends its last processed event id to /app/resync right after
     * subscribing; everything logged after that id is re-delivered on the same
     * queue, in order, as ordinary event frames.
     *
     * <p>The client subscribes before asking, so an event published in between
     * arrives both live and in the replay — delivery is at-least-once and the
     * client dedupes on event id.
     *
     * <p>When the cursor is older than the retained log, no partial replay is
     * sent: the client gets {@code resync.required} with the log's current tip
     * and reloads from the REST history instead.
     */
    @MessageMapping("/resync")
    public void resync(Principal principal, @Payload ResyncRequest request) {
        User user = extractUser(principal);
        if (user == null || request == null) {
            return;
        }
        String dest = request.dest();
        if (dest == null || !REPLAYABLE_DESTS.contains(dest)) {
            log.debug("Ignoring resync for unsupported destination {}", dest);
            return;
        }

        WebSocketEventLog.Replay replay = eventLog.replay(user.getId(), dest, request.lastEventId());

        if (replay.gap()) {
            Map<String, Object> payload = new HashMap<>();
            payload.put("cursor", replay.tip());
            send(user, dest, WebSocketMessage.of(WebSocketEventType.RESYNC_REQUIRED, payload));
            return;
        }

        for (String event : replay.events()) {
            webSocketPublisher.sendRawToUser(user.getId(), dest, event);
        }
    }

    private void send(User user, String dest, WebSocketMessage message) {
        try {
            webSocketPublisher.sendRawToUser(user.getId(), dest, objectMapper.writeValueAsString(message));
        } catch (Exception e) {
            log.error("Failed to send {} to user {}: {}", message.getType(), user.getId(), e.getMessage());
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
