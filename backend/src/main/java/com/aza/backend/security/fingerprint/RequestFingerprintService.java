package com.aza.backend.security.fingerprint;

import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.web.util.matcher.IpAddressMatcher;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;

@Service
@Slf4j
public class RequestFingerprintService {

    @Value("${app.trusted-proxy-ips:}")
    private String trustedProxyIps;

    /** Parsed at startup: each entry may be a single IP or a CIDR range. */
    private final List<IpAddressMatcher> trustedProxyMatchers = new ArrayList<>();

    @PostConstruct
    void parseTrustedProxies() {
        if (trustedProxyIps == null || trustedProxyIps.isBlank()) {
            log.warn("app.trusted-proxy-ips is empty — X-Real-IP/X-Forwarded-For will never be "
                    + "trusted, so every request behind a reverse proxy resolves to the proxy's "
                    + "IP and shares one rate-limit bucket. Set it in production.");
            return;
        }
        for (String entry : trustedProxyIps.split(",")) {
            String candidate = entry.trim();
            if (candidate.isEmpty()) continue;
            try {
                // IpAddressMatcher accepts both single addresses and CIDR ranges (v4 + v6).
                trustedProxyMatchers.add(new IpAddressMatcher(candidate));
            } catch (IllegalArgumentException e) {
                log.error("Ignoring malformed trusted-proxy entry '{}': {}", candidate, e.getMessage());
            }
        }
    }

    /**
     * Extracts the real client IP. Forwarding headers are trusted only when the
     * request arrives from a known trusted proxy (nginx, load balancer), matched
     * by exact IP or CIDR range.
     *
     * Header precedence is chosen to resist spoofing:
     *   1. X-Real-IP — nginx overwrites this with its own view of the peer
     *      ($remote_addr, or the Cloudflare-restored client IP when the real_ip
     *      module is configured), so a client can never inject it.
     *   2. CF-Connecting-IP — set by Cloudflare when the zone is proxied.
     *   3. X-Forwarded-For rightmost entry — the only element appended by our own
     *      proxy. The leftmost entries are client-supplied and trivially forged,
     *      so they must never be used for rate limiting or audit.
     */
    public String getClientIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        if (isTrustedProxy(remoteAddr)) {
            String realIp = request.getHeader("X-Real-IP");
            if (realIp != null && !realIp.isBlank()) return realIp.trim();

            String cfIp = request.getHeader("CF-Connecting-IP");
            if (cfIp != null && !cfIp.isBlank()) return cfIp.trim();

            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                String[] hops = forwarded.split(",");
                return hops[hops.length - 1].trim();
            }
        }
        return remoteAddr;
    }

    /**
     * Returns a short (16-char hex) fingerprint derived from request headers.
     * Mobile apps should send X-Device-ID for a stable device identity.
     */
    public String getDeviceFingerprint(HttpServletRequest request) {
        String deviceId = nvl(request.getHeader("X-Device-ID"));
        if (!deviceId.isBlank()) {
            // Stable device-provided ID is the best fingerprint
            return sha256(deviceId).substring(0, 16);
        }
        // Fall back to header-derived fingerprint
        String raw = nvl(request.getHeader("User-Agent"))
                + "|" + nvl(request.getHeader("Accept-Language"))
                + "|" + nvl(request.getHeader("Accept-Encoding"))
                + "|" + nvl(request.getHeader("X-Platform"));
        return sha256(raw).substring(0, 16);
    }

    /**
     * True when the caller supplied its own stable device identity rather than
     * falling back to a header-derived hash.
     *
     * The distinction matters for rate limiting. A derived fingerprint is
     * User-Agent + language + encoding + platform, which every install of the same
     * app build shares — useless as an actor key. A client-sent X-Device-ID is
     * unique per install, so it can carry limits that per-IP keys cannot: Ghanaian
     * carriers put hundreds of real users behind one CGNAT address, and an IP-keyed
     * limit throttles all of them together.
     *
     * It is client-supplied and therefore rotatable by an attacker. That is what the
     * behavioural detection and CAPTCHA challenge exist to catch; the value here is
     * that honest traffic stops colliding.
     */
    public boolean hasStableDeviceId(HttpServletRequest request) {
        return !nvl(request.getHeader("X-Device-ID")).isBlank();
    }

    /**
     * Returns CF-IPCountry header value, or null if not behind Cloudflare.
     */
    public String getCountryCode(HttpServletRequest request) {
        return request.getHeader("CF-IPCountry");
    }

    private boolean isTrustedProxy(String remoteAddr) {
        if (remoteAddr == null || trustedProxyMatchers.isEmpty()) return false;
        for (IpAddressMatcher matcher : trustedProxyMatchers) {
            try {
                if (matcher.matches(remoteAddr)) return true;
            } catch (IllegalArgumentException ignored) {
                // remoteAddr not parseable against this matcher's family — try the next
            }
        }
        return false;
    }

    private static String nvl(String s) {
        return s == null ? "" : s;
    }

    private static String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(input.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
