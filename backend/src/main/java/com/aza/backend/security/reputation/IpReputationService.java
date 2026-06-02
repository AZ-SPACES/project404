package com.aza.backend.security.reputation;

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

    @Value("${app.security.blocked-countries:}")
    private String blockedCountries;

    @Value("${app.security.trusted-ips:127.0.0.1,::1,0:0:0:0:0:0:0:1}")
    private String trustedIpsConfig;

    private static final String BLOCK_PREFIX = "iprep:block:";
    private static final String TRUST_PREFIX = "iprep:trust:";

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
        if ("XX".equals(countryCode) || "T1".equals(countryCode)) {
            // Cloudflare uses XX for unknown, T1 for Tor
            return blockedCountries.contains("TOR") || blockedCountries.contains("T1");
        }
        return blockedCountryCodes().contains(countryCode.toUpperCase());
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    private Set<String> staticTrustedIps() {
        return Arrays.stream(trustedIpsConfig.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .collect(Collectors.toSet());
    }

    private Set<String> blockedCountryCodes() {
        return Arrays.stream(blockedCountries.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .collect(Collectors.toSet());
    }
}
