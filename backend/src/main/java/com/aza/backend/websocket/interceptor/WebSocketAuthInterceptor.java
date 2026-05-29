package com.aza.backend.websocket.interceptor;

import com.aza.backend.entity.User;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;
import com.aza.backend.exception.AppException;

@Component
@RequiredArgsConstructor
@Slf4j
public class WebSocketAuthInterceptor implements ChannelInterceptor {
    private static final String BLACKLIST_PREFIX = "jwt:blacklist:";

    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;
    private final StringRedisTemplate redisTemplate;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(
                message, StompHeaderAccessor.class);

        if (accessor == null) return message;

        // Only authenticate on CONNECT — subsequent frames reuse the session
        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String authHeader = accessor.getFirstNativeHeader("Authorization");

            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                throw new IllegalArgumentException("Missing or invalid Authorization header");
            }

            String token = authHeader.substring(7);

            // Validate token signature and expiry
            if (jwtUtil.isInvalid(token)) {
                throw new IllegalArgumentException("Invalid or expired JWT token");
            }

            // Must be an ACCESS token — reject REFRESH tokens
            if (!"ACCESS".equals(jwtUtil.getTokenType(token))) {
                throw new IllegalArgumentException("Invalid token type for WebSocket");
            }

            // Check blacklist using hashed token (matches logout/deactivate logic)
            if (Boolean.TRUE.equals(redisTemplate.hasKey(BLACKLIST_PREFIX + hashToken(token)))) {
                throw new IllegalArgumentException("Token has been revoked");
            }

            // Load user
            UUID userId = jwtUtil.getUserIdFromToken(token);
            User user = userRepository.findById(userId).orElse(null);

            if (user == null || user.getStatus() != User.AccountStatus.ACTIVE) {
                throw new IllegalArgumentException("User not found or account inactive");
            }

            // Set the session principal to the user's UUID string.
            // Spring routes convertAndSendToUser(userId, ...) by matching principal.getName(),
            // so this must return the UUID — not user.toString() which is a JVM object hash.
            final String principalName = userId.toString();
            accessor.setUser(() -> principalName);
            log.info("WebSocket CONNECT authenticated: userId={}", userId);
        }

        return message;
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new AppException("SHA-256 not available", e);
        }
    }
}
