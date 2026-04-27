package com.aza.backend.util;

import com.aza.backend.exception.RateLimitExceededException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ZSetOperations.TypedTuple;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RateLimitService {

    private final StringRedisTemplate redisTemplate;

    public void enforceRateLimit(String key, int limit, Duration window) {
        long windowMillis = window.toMillis();
        long now = System.currentTimeMillis();
        String redisKey = "ratelimit:" + key;

        // Remove elements outside the current window
        redisTemplate.opsForZSet().removeRangeByScore(redisKey, 0, now - windowMillis);

        Long count = redisTemplate.opsForZSet().zCard(redisKey);

        if (count != null && count >= limit) {
            // Find when the next request will be allowed
            Set<TypedTuple<String>> elements = redisTemplate.opsForZSet().rangeByScoreWithScores(redisKey, 0, now);
            long retryAfterSeconds = window.getSeconds();
            if (elements != null && !elements.isEmpty()) {
                Double score = elements.iterator().next().getScore();
                if (score != null) {
                    long oldestTimeMillis = score.longValue();
                    long expiresAt = oldestTimeMillis + windowMillis;
                    long retryAfterMillis = expiresAt - now;
                    retryAfterSeconds = Math.max(1, retryAfterMillis / 1000);
                }
            }
            throw new RateLimitExceededException("Too many requests. Please try again later.", retryAfterSeconds);
        }

        // Add current request
        redisTemplate.opsForZSet().add(redisKey, UUID.randomUUID().toString(), now);
        // Reset expiry so the set cleans itself up if unused
        redisTemplate.expire(redisKey, window);
    }
}
