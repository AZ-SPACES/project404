package com.aza.backend.security.behavior;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Collections;

/**
 * Tracks per-actor behavioral signals and applies progressive blocks when abuse is detected.
 *
 * Actor keys follow the pattern "ip:{addr}" or "fp:{fingerprint}" or "user:{id}".
 * Suspicion points accumulate per actor; when the threshold is crossed the actor
 * is blocked with an exponentially growing penalty.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BehavioralDetectionService {

    private final StringRedisTemplate redis;

    // Window used by trackRequest() to count requests for burst detection.
    // The threshold itself lives in RateLimitFilter (app.ratelimit.burst.threshold).
    private static final int BURST_WINDOW_SECONDS = 5;

    // Points before an auto-block is triggered
    private static final int SUSPICION_BLOCK_THRESHOLD = 50;

    // Progressive block durations (seconds): 15 min → 1 hr → 6 hr → 24 hr
    private static final long[] BLOCK_DURATIONS = {900L, 3600L, 21600L, 86400L};

    // Atomically prune old entries, record the new request, return current window count.
    private static final RedisScript<Long> BURST_SCRIPT = RedisScript.of(
            "local key = KEYS[1]\n" +
            "local now = tonumber(ARGV[1])\n" +
            "local windowMs = tonumber(ARGV[2])\n" +
            "redis.call('ZREMRANGEBYSCORE', key, 0, now - windowMs)\n" +
            "redis.call('ZADD', key, now, now .. '-' .. math.random(1,999999))\n" +
            "redis.call('PEXPIRE', key, windowMs)\n" +
            "return redis.call('ZCARD', key)",
            Long.class
    );

    // ── Block checks ─────────────────────────────────────────────────────────

    public boolean isBlocked(String actorKey) {
        try {
            return Boolean.TRUE.equals(redis.hasKey("behavior:block:" + actorKey));
        } catch (Exception e) {
            return false;
        }
    }

    public long getBlockTtlSeconds(String actorKey) {
        try {
            Long ttl = redis.getExpire("behavior:block:" + actorKey);
            return (ttl != null && ttl > 0) ? ttl : 60;
        } catch (Exception e) {
            return 60;
        }
    }

    // ── Tracking ──────────────────────────────────────────────────────────────

    /**
     * Records a request and returns the burst count for the current window.
     */
    public long trackRequest(String actorKey) {
        try {
            long now = System.currentTimeMillis();
            Long count = redis.execute(
                    BURST_SCRIPT,
                    Collections.singletonList("behavior:burst:" + actorKey),
                    String.valueOf(now),
                    String.valueOf((long) BURST_WINDOW_SECONDS * 1000)
            );
            return count != null ? count : 0;
        } catch (Exception e) {
            return 0;
        }
    }

    /**
     * Records a failed authentication attempt. Returns the cumulative failure count.
     */
    public long recordFailure(String actorKey) {
        try {
            String key = "behavior:fail:" + actorKey;
            Long n = redis.opsForValue().increment(key);
            redis.expire(key, Duration.ofMinutes(15));
            return n != null ? n : 0;
        } catch (Exception e) {
            return 0;
        }
    }

    // ── Suspicion scoring ────────────────────────────────────────────────────

    public long addSuspicion(String actorKey, int points) {
        String key = "behavior:score:" + actorKey;
        Long total = redis.opsForValue().increment(key, points);
        redis.expire(key, Duration.ofHours(1));
        return total != null ? total : 0;
    }

    public long getSuspicionScore(String actorKey) {
        String val = redis.opsForValue().get("behavior:score:" + actorKey);
        return val != null ? Long.parseLong(val) : 0;
    }

    /**
     * Adds suspicion and auto-blocks the actor if the threshold is crossed.
     * Returns true if a block was applied.
     */
    public boolean reportSuspiciousEvent(String actorKey, int points) {
        try {
            long score = addSuspicion(actorKey, points);
            if (score >= SUSPICION_BLOCK_THRESHOLD) {
                long duration = blockActor(actorKey);
                log.warn("Auto-blocked actor {} for {}s (suspicion score {})", actorKey, duration, score);
                return true;
            }
        } catch (Exception e) {
            log.warn("Behavioral scoring unavailable for {}: {}", actorKey, e.getMessage());
        }
        return false;
    }

    // ── Blocking ──────────────────────────────────────────────────────────────

    /**
     * Applies a progressive block to the actor. Penalty doubles on each repeat violation.
     * Returns the block duration in seconds.
     */
    public long blockActor(String actorKey) {
        String violKey = "behavior:violations:" + actorKey;
        Long violations = redis.opsForValue().increment(violKey);
        redis.expire(violKey, Duration.ofDays(7));

        int idx = (int) Math.min((violations != null ? violations : 1) - 1, BLOCK_DURATIONS.length - 1);
        long durationSeconds = BLOCK_DURATIONS[idx];

        redis.opsForValue().set("behavior:block:" + actorKey, "1", Duration.ofSeconds(durationSeconds));
        redis.delete("behavior:score:" + actorKey);
        return durationSeconds;
    }

    public void blockForDuration(String actorKey, Duration duration) {
        redis.opsForValue().set("behavior:block:" + actorKey, "1", duration);
    }

    public void unblock(String actorKey) {
        redis.delete("behavior:block:" + actorKey);
        redis.delete("behavior:score:" + actorKey);
        redis.delete("behavior:violations:" + actorKey);
    }
}
