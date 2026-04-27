package com.aza.backend.service;

import com.aza.backend.config.RedisPubSubConfig;
import com.aza.backend.dto.websocket.WebSocketEventType;
import com.aza.backend.dto.websocket.WebSocketMessage;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class WebSocketPublisher {

    private final StringRedisTemplate redisTemplate;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectMapper objectMapper;

    /**
     * Send a notification event to a specific user via Redis pub/sub.
     * The RedisMessageSubscriber forwards it over WebSocket to the user's /queue/notifications.
     */
    public void publishNotification(UUID userId, WebSocketEventType type, Object payload) {
        publish(RedisPubSubConfig.NOTIFY_CHANNEL_PREFIX + userId, type, payload);
    }

    /**
     * Broadcast a presence event (USER_ONLINE / USER_OFFLINE) to all connected clients.
     */
    public void publishPresence(WebSocketEventType type, Object payload) {
        publish(RedisPubSubConfig.PRESENCE_CHANNEL, type, payload);
    }

    /**
     * Send directly to a user on this instance — no Redis hop.
     * Use for low-latency responses to the sender (e.g. heartbeat ack).
     */
    public void sendToUser(String userId, String destination, Object payload) {
        messagingTemplate.convertAndSendToUser(userId, destination, payload);
    }

    private void publish(String channel, WebSocketEventType type, Object payload) {
        try {
            String json = objectMapper.writeValueAsString(WebSocketMessage.of(type, payload));
            redisTemplate.convertAndSend(channel, json);
        } catch (Exception e) {
            log.error("Failed to publish WebSocket event type={} to channel={}: {}",
                    type, channel, e.getMessage());
        }
    }
}
