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

        Long result = redisTemplate.execute(
                RATE_LIMIT_SCRIPT,
                Collections.singletonList(redisKey),
                String.valueOf(now),
                String.valueOf(windowMillis),
                String.valueOf(limit),
                UUID.randomUUID().toString()
        );

        if (result != null && result == 1L) {
            long retryAfterSeconds = window.getSeconds();
            // Best-effort retry-after calculation (non-critical path)
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
            throw new RateLimitExceededException("Too many requests. Please try again later.", retryAfterSeconds);
        }
    }
}
