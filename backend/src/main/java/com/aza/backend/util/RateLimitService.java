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
        if (isGloballyDisabled()) return;

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

    // ── Global kill switch ────────────────────────────────────────────────────
    // Admin-operated break-glass control (see AdminRateLimitController). Stored in Redis so the
    // switch applies to every backend instance at once and survives a restart, instead of the
    // static app.ratelimit.enabled property which needs a redeploy to change.

    private static final String GLOBAL_DISABLE_KEY = "ratelimit:switch:disabled";

    /** Redis is consulted at most this often — the switch sits on every request's hot path. */
    private static final long SWITCH_CACHE_MILLIS = 2_000;

    private volatile boolean switchDisabled = false;
    private volatile long switchCheckedUntil = 0;

    /** True when an admin has switched rate limiting off platform-wide. */
    public boolean isGloballyDisabled() {
        long now = System.currentTimeMillis();
        if (now < switchCheckedUntil) return switchDisabled;
        try {
            switchDisabled = Boolean.TRUE.equals(redisTemplate.hasKey(GLOBAL_DISABLE_KEY));
        } catch (org.springframework.dao.DataAccessException e) {
            // Redis unreachable — assume the switch is off. enforceRateLimit() fails open
            // separately, so this never turns an outage into a lockout.
            return false;
        }
        switchCheckedUntil = now + SWITCH_CACHE_MILLIS;
        return switchDisabled;
    }

    /**
     * Turns rate limiting off (or back on) across the whole platform.
     *
     * @param ttl how long the switch stays off; null keeps it off until an admin turns it back on.
     *            A TTL is strongly preferred — it guarantees the platform re-arms itself even if
     *            someone forgets to flip the switch back.
     */
    public void setGloballyDisabled(boolean disabled, Duration ttl) {
        if (disabled) {
            String stamp = String.valueOf(System.currentTimeMillis());
            if (ttl != null && !ttl.isZero() && !ttl.isNegative()) {
                redisTemplate.opsForValue().set(GLOBAL_DISABLE_KEY, stamp, ttl);
            } else {
                redisTemplate.opsForValue().set(GLOBAL_DISABLE_KEY, stamp);
            }
        } else {
            redisTemplate.delete(GLOBAL_DISABLE_KEY);
        }
        // Reflect the change on this instance immediately; others pick it up within the cache TTL.
        switchDisabled = disabled;
        switchCheckedUntil = System.currentTimeMillis() + SWITCH_CACHE_MILLIS;
    }

    /**
     * Seconds until the kill switch auto-expires: -1 when it never expires (or is off entirely).
     */
    public long getGlobalDisableTtlSeconds() {
        try {
            Long ttl = redisTemplate.getExpire(GLOBAL_DISABLE_KEY);
            return ttl != null && ttl > 0 ? ttl : -1;
        } catch (Exception e) {
            return -1;
        }
    }
}
