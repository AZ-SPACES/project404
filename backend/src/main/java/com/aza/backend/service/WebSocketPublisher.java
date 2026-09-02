package com.aza.backend.service;

import com.aza.backend.config.RedisPubSubConfig;
import com.aza.backend.dto.websocket.WebSocketEventType;
import com.aza.backend.dto.websocket.WebSocketMessage;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class WebSocketPublisher {

    /**
     * STOMP queue suffixes. These double as the {@code dest} recorded in the
     * event log, so a replay can be scoped to the queue the client is asking
     * about — see {@link WebSocketEventLog}.
     */
    public static final String DEST_CHAT = "chat";
    public static final String DEST_CALLS = "calls";
    public static final String DEST_PRESENCE = "presence";
    public static final String DEST_NOTIFICATIONS = "notifications";

    private final StringRedisTemplate redisTemplate;
    private final SimpMessagingTemplate messagingTemplate;
    private final WebSocketEventLog eventLog;
    private final ObjectMapper objectMapper;

    /**
     * Single-instance optimization: when true, real-time events are delivered
     * straight to the local STOMP session instead of going through a Redis
     * publish/subscribe round-trip. MUST stay false when running more than one
     * backend instance — a recipient connected to another instance would never
     * receive the event. Default false keeps the safe cross-instance behavior.
     *
     * <p>Independent of the event log: durable events are appended to the log
     * either way, so replay works the same on one instance or several.
     */
    @Value("${app.websocket.local-delivery:false}")
    private boolean localDeliveryOnly;

    /**
     * Send a notification event to a specific user via Redis pub/sub.
     * The RedisMessageSubscriber forwards it over WebSocket to the user's /queue/notifications.
     */
    public void publishNotification(UUID userId, WebSocketEventType type, Object payload) {
        publish(userId, RedisPubSubConfig.NOTIFY_CHANNEL_PREFIX + userId, DEST_NOTIFICATIONS, type, payload);
    }

    /**
     * Send a chat event to both participants via their private per-user queues.
     * Replaces the old /topic/chat/{chatId} broadcast which any subscriber could eavesdrop on.
     */
    public void publishToChatRoom(UUID participantOne, UUID participantTwo,
                                   WebSocketEventType type, Object payload) {
        publish(participantOne, RedisPubSubConfig.CHAT_USER_CHANNEL_PREFIX + participantOne,
                DEST_CHAT, type, payload);
        publish(participantTwo, RedisPubSubConfig.CHAT_USER_CHANNEL_PREFIX + participantTwo,
                DEST_CHAT, type, payload);
    }

    /**
     * Send a call signaling event to a specific user via Redis pub/sub.
     * The RedisMessageSubscriber forwards it to the user's /queue/calls.
     */
    public void publishCallEvent(UUID userId, WebSocketEventType type, Object payload) {
        publish(userId, RedisPubSubConfig.CALL_CHANNEL_PREFIX + userId, DEST_CALLS, type, payload);
    }

    /**
     * Send a presence event (USER_ONLINE / USER_OFFLINE) to one recipient's
     * /user/queue/presence. Presence is intentionally not broadcast: only users
     * with a chat or contact relationship to the subject should learn about it.
     */
    public void publishPresenceToUser(UUID recipientId, WebSocketEventType type, Object payload) {
        publish(recipientId, RedisPubSubConfig.PRESENCE_USER_CHANNEL_PREFIX + recipientId,
                DEST_PRESENCE, type, payload);
    }

    /**
     * Broadcast a support inbox event to all admin agents subscribed to /topic/admin/support.
     * Used to push live inbox updates when any user sends a support message.
     */
    public void publishToAdminSupport(WebSocketEventType type, Object payload) {
        // No recipient id: a shared topic has no per-user cursor, so these are
        // never logged regardless of the event type's durability.
        publish(null, RedisPubSubConfig.ADMIN_SUPPORT_CHANNEL, null, type, payload);
    }

    /**
     * Send it directly to a user on this instance — no Redis hop.
     * Use for low-latency responses to the sender (e.g., heartbeat ack).
     */
    public void sendToUser(String userId, String destination, Object payload) {
        messagingTemplate.convertAndSendToUser(userId, destination, payload);
    }

    /**
     * Deliver an event that was already serialized and logged — used by the
     * replay path, which re-sends stored events to a reconnecting client
     * without logging them a second time.
     */
    public void sendRawToUser(UUID userId, String dest, String json) {
        messagingTemplate.convertAndSendToUser(userId.toString(), "/queue/" + dest, json);
    }

    /**
     * Append the event to the recipient's durable log (when the type warrants
     * it), then hand it to the live transport carrying the log entry id.
     *
     * <p>Order matters: the log write happens first so that an event delivered
     * live is always already recoverable. The reverse would leave a window in
     * which a client receives an event, drops the connection, and asks for a
     * replay that does not contain it.
     */
    private void publish(UUID recipientId, String channel, String dest,
                         WebSocketEventType type, Object payload) {
        try {
            WebSocketMessage message = WebSocketMessage.of(type, payload);
            String json = objectMapper.writeValueAsString(message);

            if (recipientId != null && dest != null && type.isDurable()) {
                String eventId = eventLog.append(recipientId, dest, json);
                if (eventId != null) {
                    // Re-serialize rather than patch the string: the id has to
                    // reach the client inside the same frame it labels.
                    message.setId(eventId);
                    json = objectMapper.writeValueAsString(message);
                }
            }

            if (localDeliveryOnly) {
                deliverLocally(channel, json);
            } else {
                redisTemplate.convertAndSend(channel, json);
            }
        } catch (Exception e) {
            log.error("Failed to publish WebSocket event type={} to channel={}: {}",
                    type, channel, e.getMessage());
        }
    }

    /**
     * Forward straight to the local STOMP destination, skipping Redis. Mirrors the
     * channel→destination mapping in {@link com.aza.backend.websocket.handler.RedisMessageSubscriber}.
     */
    private void deliverLocally(String channel, String json) {
        if (channel.startsWith(RedisPubSubConfig.CHAT_USER_CHANNEL_PREFIX)) {
            messagingTemplate.convertAndSendToUser(
                    channel.substring(RedisPubSubConfig.CHAT_USER_CHANNEL_PREFIX.length()), "/queue/chat", json);
        } else if (channel.startsWith(RedisPubSubConfig.CALL_CHANNEL_PREFIX)) {
            messagingTemplate.convertAndSendToUser(
                    channel.substring(RedisPubSubConfig.CALL_CHANNEL_PREFIX.length()), "/queue/calls", json);
        } else if (channel.startsWith(RedisPubSubConfig.PRESENCE_USER_CHANNEL_PREFIX)) {
            messagingTemplate.convertAndSendToUser(
                    channel.substring(RedisPubSubConfig.PRESENCE_USER_CHANNEL_PREFIX.length()), "/queue/presence", json);
        } else if (channel.startsWith(RedisPubSubConfig.NOTIFY_CHANNEL_PREFIX)) {
            messagingTemplate.convertAndSendToUser(
                    channel.substring(RedisPubSubConfig.NOTIFY_CHANNEL_PREFIX.length()), "/queue/notifications", json);
        } else if (channel.equals(RedisPubSubConfig.ADMIN_SUPPORT_CHANNEL)) {
            messagingTemplate.convertAndSend("/topic/admin/support", json);
        }
    }
}
