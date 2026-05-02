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
     * Send a chat event to both participants via their private per-user queues.
     * Replaces the old /topic/chat/{chatId} broadcast which any subscriber could eavesdrop on.
     */
    public void publishToChatRoom(UUID participantOne, UUID participantTwo,
                                   WebSocketEventType type, Object payload) {
        publish(RedisPubSubConfig.CHAT_USER_CHANNEL_PREFIX + participantOne, type, payload);
        publish(RedisPubSubConfig.CHAT_USER_CHANNEL_PREFIX + participantTwo, type, payload);
    }

    /**
     * Send a call signalling event to a specific user via Redis pub/sub.
     * The RedisMessageSubscriber forwards it to the user's /queue/calls.
     */
    public void publishCallEvent(UUID userId, WebSocketEventType type, Object payload) {
        publish(RedisPubSubConfig.CALL_CHANNEL_PREFIX + userId, type, payload);
    }

    /**
     * Broadcast a presence event (USER_ONLINE / USER_OFFLINE) to all connected clients.
     */
    public void publishPresence(WebSocketEventType type, Object payload) {
        publish(RedisPubSubConfig.PRESENCE_CHANNEL, type, payload);
    }

    /**
     * Broadcast a support inbox event to all admin agents subscribed to /topic/admin/support.
     * Used to push live inbox updates when any user sends a support message.
     */
    public void publishToAdminSupport(WebSocketEventType type, Object payload) {
        publish(RedisPubSubConfig.ADMIN_SUPPORT_CHANNEL, type, payload);
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
