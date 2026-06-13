package com.aza.backend.util;

import com.aza.backend.exception.RateLimitExceededException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations.TypedTuple;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Collections;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RateLimitService {

    private final StringRedisTemplate redisTemplate;

    // Atomically: prune old entries, check count, add if under limit.
    // Returns 0 if request is allowed, 1 if rate limit exceeded.
    private static final RedisScript<Long> RATE_LIMIT_SCRIPT = RedisScript.of(
            "local key = KEYS[1]\n" +
            "local now = tonumber(ARGV[1])\n" +
            "local window = tonumber(ARGV[2])\n" +
            "local limit = tonumber(ARGV[3])\n" +
            "local member = ARGV[4]\n" +
            "redis.call('ZREMRANGEBYSCORE', key, 0, now - window)\n" +
            "local count = redis.call('ZCARD', key)\n" +
            "if count >= limit then return 1 end\n" +
            "redis.call('ZADD', key, now, member)\n" +
            "redis.call('PEXPIRE', key, window)\n" +
            "return 0",
            Long.class
    );

    public void enforceRateLimit(String key, int limit, Duration window) {
        long now = System.currentTimeMillis();
        long windowMillis = window.toMillis();
        String redisKey = "ratelimit:" + key;

        Long result;
        try {
            result = redisTemplate.execute(
                    RATE_LIMIT_SCRIPT,
                    Collections.singletonList(redisKey),
                    String.valueOf(now),
                    String.valueOf(windowMillis),
                    String.valueOf(limit),
                    UUID.randomUUID().toString()
            );
        } catch (org.springframework.dao.DataAccessException e) {
            // Redis unavailable — fail open so requests aren't blocked during outages
            return;
        }

        if (result != null && result == 1L) {
            long retryAfterSeconds = window.getSeconds();
            // Best-effort retry-after calculation (non-critical path)
            try {
                Set<TypedTuple<String>> elements = redisTemplate.opsForZSet()
                        .rangeByScoreWithScores(redisKey, 0, now);
                if (elements != null && !elements.isEmpty()) {
                    Double score = elements.iterator().next().getScore();
                    if (score != null) {
                        long expiresAt = score.longValue() + windowMillis;
                        long retryAfterMillis = expiresAt - now;
                        retryAfterSeconds = Math.max(1, retryAfterMillis / 1000);
                    }
                }
            } catch (Exception ignored) {
                // Non-critical — proceed with default retry-after
            }
            throw new RateLimitExceededException("Too many requests. Please try again later.", retryAfterSeconds);
        }
    }

    /**
     * Non-throwing check: returns the number of remaining slots in the current window.
     * Does NOT consume a slot — use enforceRateLimit() for actual limiting.
     */
    public long getRemainingCount(String key, int limit, Duration window) {
        try {
            long now = System.currentTimeMillis();
            String redisKey = "ratelimit:" + key;
            redisTemplate.opsForZSet().removeRangeByScore(redisKey, 0, now - window.toMillis());
            Long used = redisTemplate.opsForZSet().zCard(redisKey);
            return Math.max(0, limit - (used != null ? used : 0));
        } catch (Exception e) {
            return limit;
        }
    }

    /** Clear all sliding-window counters for a specific user. */
    public void resetUser(UUID userId) {
        redisTemplate.delete("ratelimit:user:" + userId);
    }

    /** Clear all sliding-window counters for a specific IP address. */
    public void resetIp(String ip) {
        redisTemplate.delete("ratelimit:ip:" + ip);
        redisTemplate.delete("ratelimit:ip_auth:" + ip);
    }

    /**
     * Flush every rate-limit counter across all actors.
     * Uses SCAN to avoid blocking Redis with a KEYS * call.
     * Returns the number of keys deleted.
     */
    public long resetAll() {
        Set<String> keys = redisTemplate.keys("ratelimit:*");
        if (keys == null || keys.isEmpty()) return 0;
        Long deleted = redisTemplate.delete(keys);
        return deleted != null ? deleted : 0;
    }

    public long countActiveKeys() {
        Set<String> keys = redisTemplate.keys("ratelimit:*");
        return keys != null ? keys.size() : 0;
    }
}
