package com.aza.backend.service;

import com.aza.backend.dto.websocket.WebSocketEventType;
import com.aza.backend.entity.User;
import com.aza.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Tracks who is online and from which device session.
 *
 * Redis keys:
 *   presence:user:{userId}        — "ONLINE", TTL-based; refreshed by connects/heartbeats
 *   presence:conns:{userId}       — SET of live WS session ids (a user may hold several
 *                                   sockets: presence, chat, calls); user goes offline
 *                                   when the last one disconnects
 *   presence:device:{tokenId}     — userId, TTL-based; one per RefreshToken (device session),
 *                                   powers the "online" dot in the devices list
 *   presence:lastseen:{userId}    — ISO timestamp of last activity, long TTL
 *
 * The DB mirror (users.online_status / users.last_seen_at) is only written on
 * transitions, and a sweeper reconciles rows whose Redis key expired without a
 * clean disconnect (app killed, network drop) so nobody stays "online" forever.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PresenceService {

    private static final String USER_KEY_PREFIX = "presence:user:";
    private static final String CONNS_KEY_PREFIX = "presence:conns:";
    private static final String DEVICE_KEY_PREFIX = "presence:device:";
    private static final String LAST_SEEN_PREFIX = "presence:lastseen:";

    private static final Duration CONNS_TTL = Duration.ofHours(12);
    private static final Duration LAST_SEEN_TTL = Duration.ofDays(30);

    @Value("${app.presence.ttl-seconds:65}")
    private int ttlSeconds;

    private final StringRedisTemplate redisTemplate;
    private final UserRepository userRepository;
    private final WebSocketPublisher webSocketPublisher;

    // ==================== Connection lifecycle ====================

    /** A WebSocket session opened — called from the connect event listener. */
    public void connectionOpened(UUID userId, String wsSessionId, String deviceSessionId) {
        try {
            if (wsSessionId != null) {
                String connsKey = CONNS_KEY_PREFIX + userId;
                redisTemplate.opsForSet().add(connsKey, wsSessionId);
                redisTemplate.expire(connsKey, CONNS_TTL);
            }
            markOnline(userId);
            touchDevice(userId, deviceSessionId);
            touchLastSeen(userId);
        } catch (Exception e) {
            log.error("Failed to register connection for user {}: {}", userId, e.getMessage());
        }
    }

    /** A WebSocket session closed — the user goes offline once their last socket is gone. */
    public void connectionClosed(UUID userId, String wsSessionId, String deviceSessionId) {
        try {
            touchLastSeen(userId);
            String connsKey = CONNS_KEY_PREFIX + userId;
            if (wsSessionId != null) {
                redisTemplate.opsForSet().remove(connsKey, wsSessionId);
            }
            Long remaining = redisTemplate.opsForSet().size(connsKey);
            if (remaining == null || remaining == 0) {
                if (deviceSessionId != null) {
                    redisTemplate.delete(DEVICE_KEY_PREFIX + deviceSessionId);
                }
                markOffline(userId);
            }
        } catch (Exception e) {
            log.error("Failed to unregister connection for user {}: {}", userId, e.getMessage());
        }
    }

    /** Client heartbeat (~30s) — refreshes user + device presence TTLs. */
    public void heartbeat(UUID userId, String deviceSessionId) {
        try {
            markOnline(userId);
            touchDevice(userId, deviceSessionId);
            touchLastSeen(userId);
            String connsKey = CONNS_KEY_PREFIX + userId;
            if (Boolean.TRUE.equals(redisTemplate.hasKey(connsKey))) {
                redisTemplate.expire(connsKey, CONNS_TTL);
            }
        } catch (Exception e) {
            log.error("Heartbeat failed for user {}: {}", userId, e.getMessage());
        }
    }

    // ==================== Queries ====================

    public boolean isOnline(UUID userId) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(USER_KEY_PREFIX + userId));
    }

    public String getStatus(UUID userId) {
        return isOnline(userId) ? "ONLINE" : "OFFLINE";
    }

    /** True if the given device session (RefreshToken id) heartbeated recently. */
    public boolean isSessionOnline(UUID refreshTokenId) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(DEVICE_KEY_PREFIX + refreshTokenId));
    }

    /**
     * Last activity timestamp — live Redis value first, DB mirror as fallback
     * for users who haven't connected since the last Redis flush.
     */
    public LocalDateTime getLastSeen(UUID userId) {
        LocalDateTime live = getLastSeenLive(userId);
        if (live != null) return live;
        return userRepository.findById(userId).map(User::getLastSeenAt).orElse(null);
    }

    /** Redis-only last-seen — use with an already-loaded User to avoid an extra DB hit. */
    public LocalDateTime getLastSeenLive(UUID userId) {
        try {
            String raw = redisTemplate.opsForValue().get(LAST_SEEN_PREFIX + userId);
            if (raw != null) return LocalDateTime.parse(raw);
        } catch (Exception e) {
            log.debug("Failed to read lastSeen for {}: {}", userId, e.getMessage());
        }
        return null;
    }

    public long countOnlineUsers() {
        try {
            Set<String> keys = redisTemplate.keys(USER_KEY_PREFIX + "*");
            return keys != null ? keys.size() : 0;
        } catch (Exception e) {
            log.error("Failed to count online users: {}", e.getMessage());
            return 0;
        }
    }

    // ==================== Reconciliation ====================

    /**
     * Safety net for sockets that died without a DISCONNECT frame (app killed,
     * network drop): once the Redis TTL lapses, flip the DB mirror to OFFLINE
     * and broadcast the event so chat/admin views don't show ghosts.
     */
    @Scheduled(fixedDelay = 30_000, initialDelay = 30_000)
    @Transactional
    public void sweepStalePresence() {
        List<User> marked = userRepository.findAllByOnlineStatus(User.OnlineStatus.ONLINE);
        for (User user : marked) {
            if (!isOnline(user.getId())) {
                user.setOnlineStatus(User.OnlineStatus.OFFLINE);
                user.setLastSeenAt(lastSeenOrNow(user.getId()));
                userRepository.save(user);
                redisTemplate.delete(CONNS_KEY_PREFIX + user.getId());
                publishPresenceEvent(user.getId(), "OFFLINE");
                log.info("Swept stale presence for user {}", user.getId());
            }
        }
    }

    // ==================== Internals ====================

    /** Refresh the user-level key; on the offline→online transition, mirror to DB and broadcast. */
    private void markOnline(UUID userId) {
        String key = USER_KEY_PREFIX + userId;
        boolean wasOnline = Boolean.TRUE.equals(redisTemplate.hasKey(key));
        redisTemplate.opsForValue().set(key, "ONLINE", Duration.ofSeconds(ttlSeconds));
        if (!wasOnline) {
            userRepository.findById(userId).ifPresent(user -> {
                user.setOnlineStatus(User.OnlineStatus.ONLINE);
                userRepository.save(user);
            });
            publishPresenceEvent(userId, "ONLINE");
            log.debug("User {} is now ONLINE", userId);
        }
    }

    private void markOffline(UUID userId) {
        redisTemplate.delete(USER_KEY_PREFIX + userId);
        userRepository.findById(userId).ifPresent(user -> {
            user.setOnlineStatus(User.OnlineStatus.OFFLINE);
            user.setLastSeenAt(lastSeenOrNow(userId));
            userRepository.save(user);
        });
        publishPresenceEvent(userId, "OFFLINE");
        log.debug("User {} is now OFFLINE", userId);
    }

    private void touchDevice(UUID userId, String deviceSessionId) {
        if (deviceSessionId == null) return;
        redisTemplate.opsForValue().set(
                DEVICE_KEY_PREFIX + deviceSessionId, userId.toString(), Duration.ofSeconds(ttlSeconds));
    }

    private void touchLastSeen(UUID userId) {
        redisTemplate.opsForValue().set(
                LAST_SEEN_PREFIX + userId, LocalDateTime.now().toString(), LAST_SEEN_TTL);
    }

    private LocalDateTime lastSeenOrNow(UUID userId) {
        try {
            String raw = redisTemplate.opsForValue().get(LAST_SEEN_PREFIX + userId);
            if (raw != null) return LocalDateTime.parse(raw);
        } catch (Exception ignored) {
            // fall through to now()
        }
        return LocalDateTime.now();
    }

    private void publishPresenceEvent(UUID userId, String status) {
        WebSocketEventType eventType = "ONLINE".equals(status)
                ? WebSocketEventType.USER_ONLINE
                : WebSocketEventType.USER_OFFLINE;
        webSocketPublisher.publishPresence(eventType,
                Map.of("userId", userId.toString(), "status", status));
    }
}
