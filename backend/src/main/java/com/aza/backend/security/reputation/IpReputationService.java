package com.aza.backend.security.reputation;

import com.aza.backend.repository.SystemSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Manages IP-level reputation: permanent/TTL blocks, trust list, and geo-blocking.
 *
 * Geo-blocking relies on Cloudflare's CF-IPCountry header.
 * For environments not behind Cloudflare, country codes will simply not be available.
 */
@Service
@RequiredArgsConstructor
public class IpReputationService {

    private final StringRedisTemplate redis;
    private final SystemSettingRepository settingRepo;

    @Value("${app.security.blocked-countries:KP,CU,IR,SY,RU,BY,MM}")
    private String blockedCountriesFallback;

    @Value("${app.security.trusted-ips:127.0.0.1,::1,0:0:0:0:0:0:0:1}")
    private String trustedIpsConfig;

    private static final String BLOCK_PREFIX = "iprep:block:";
    private static final String TRUST_PREFIX = "iprep:trust:";
    private static final long CACHE_TTL_MS = 60_000;

    private volatile Set<String> cachedBlockedCodes = null;
    private volatile long cacheExpiresAt = 0;

    // ── Trust ─────────────────────────────────────────────────────────────────

    public boolean isTrusted(String ip) {
        try {
            if (Boolean.TRUE.equals(redis.hasKey(TRUST_PREFIX + ip))) return true;
        } catch (Exception e) {
            // Redis unavailable — fall through to static list
        }
        return staticTrustedIps().contains(ip);
    }

    public void trustIp(String ip) {
        redis.opsForValue().set(TRUST_PREFIX + ip, "1");
    }

    // ── Block ─────────────────────────────────────────────────────────────────

    public boolean isBlocked(String ip) {
        try {
            if (isTrusted(ip)) return false;
            return Boolean.TRUE.equals(redis.hasKey(BLOCK_PREFIX + ip));
        } catch (Exception e) {
            return false;
        }
    }

    public void blockIp(String ip, Duration ttl) {
        redis.opsForValue().set(BLOCK_PREFIX + ip, "1", ttl);
    }

    public void blockIpPermanently(String ip) {
        // No TTL — manual unblock required
        redis.opsForValue().set(BLOCK_PREFIX + ip, "1");
    }

    public void unblockIp(String ip) {
        redis.delete(BLOCK_PREFIX + ip);
    }

    public long getBlockTtlSeconds(String ip) {
        Long ttl = redis.getExpire(BLOCK_PREFIX + ip);
        return (ttl != null && ttl > 0) ? ttl : 0;
    }

    // ── Geo-blocking (Cloudflare CF-IPCountry header) ─────────────────────────

    public boolean isCountryBlocked(String countryCode) {
        if (countryCode == null || countryCode.isBlank()) return false;
        Set<String> codes = blockedCountryCodes();
        if ("XX".equals(countryCode) || "T1".equals(countryCode)) {
            // Cloudflare uses XX for unknown, T1 for Tor
            return codes.contains("TOR") || codes.contains("T1");
        }
        return codes.contains(countryCode.toUpperCase());
    }

    /** Force the next call to reload from DB, e.g. after an admin update. */
    public void invalidateGeoBlockCache() {
        cacheExpiresAt = 0;
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    private Set<String> staticTrustedIps() {
        return Arrays.stream(trustedIpsConfig.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .collect(Collectors.toSet());
    }

    private Set<String> blockedCountryCodes() {
        long now = System.currentTimeMillis();
        if (cachedBlockedCodes != null && now < cacheExpiresAt) {
            return cachedBlockedCodes;
        }
        // DB value takes precedence; fall back to application property when no DB entry exists.
        String raw = settingRepo.findById("blocked_countries")
                .map(s -> s.getValue())
                .orElse(blockedCountriesFallback);
        Set<String> codes = Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .collect(Collectors.toSet());
        cachedBlockedCodes = codes;
        cacheExpiresAt = now + CACHE_TTL_MS;
        return codes;
    }
}
