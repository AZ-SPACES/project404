package com.aza.backend.service;

import com.aza.backend.dto.websocket.WebSocketEventType;
import com.aza.backend.entity.User;
import com.aza.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class PresenceService {

    private static final String PRESENCE_PREFIX = "presence:";
    private static final Duration PRESENCE_TTL = Duration.ofSeconds(65);

    private final StringRedisTemplate redisTemplate;
    private final UserRepository userRepository;
    private final WebSocketPublisher webSocketPublisher;

    public void setOnline(UUID userId) {
        try {
            redisTemplate.opsForValue().set(PRESENCE_PREFIX + userId, "ONLINE", PRESENCE_TTL);

            userRepository.findById(userId).ifPresent(user -> {
                user.setOnlineStatus(User.OnlineStatus.ONLINE);
                userRepository.save(user);
            });

            publishPresenceEvent(userId, "ONLINE");
            log.debug("User {} is now ONLINE", userId);
        } catch (Exception e) {
            log.error("Failed to set user {} online: {}", userId, e.getMessage());
        }
    }

    public void setOffline(UUID userId) {
        try {
            redisTemplate.delete(PRESENCE_PREFIX + userId);

            userRepository.findById(userId).ifPresent(user -> {
                user.setOnlineStatus(User.OnlineStatus.OFFLINE);
                userRepository.save(user);
            });

            publishPresenceEvent(userId, "OFFLINE");
            log.debug("User {} is now OFFLINE", userId);
        } catch (Exception e) {
            log.error("Failed to set user {} offline: {}", userId, e.getMessage());
        }
    }

    public boolean isOnline(UUID userId) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(PRESENCE_PREFIX + userId));
    }

    public void heartbeat(UUID userId) {
        redisTemplate.expire(PRESENCE_PREFIX + userId, PRESENCE_TTL);
    }

    public String getStatus(UUID userId) {
        return isOnline(userId) ? "ONLINE" : "OFFLINE";
    }

    private void publishPresenceEvent(UUID userId, String status) {
        WebSocketEventType eventType = "ONLINE".equals(status)
                ? WebSocketEventType.USER_ONLINE
                : WebSocketEventType.USER_OFFLINE;
        webSocketPublisher.publishPresence(eventType,
                Map.of("userId", userId.toString(), "status", status));
    }
}
