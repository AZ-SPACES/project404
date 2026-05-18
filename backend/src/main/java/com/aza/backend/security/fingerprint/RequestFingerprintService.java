package com.aza.backend.security.fingerprint;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.Arrays;

@Service
public class RequestFingerprintService {

    @Value("${app.trusted-proxy-ips:}")
    private String trustedProxyIps;

    /**
     * Extracts the real client IP. Trusts X-Forwarded-For only when the request
     * arrives from a known trusted proxy (load balancer, Cloudflare, etc.).
     */
    public String getClientIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        if (isTrustedProxy(remoteAddr)) {
            String cfIp = request.getHeader("CF-Connecting-IP"); // Cloudflare
            if (cfIp != null && !cfIp.isBlank()) return cfIp.trim();

            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                // Leftmost entry is the original client
                return forwarded.split(",")[0].trim();
            }
            String realIp = request.getHeader("X-Real-IP");
            if (realIp != null && !realIp.isBlank()) return realIp.trim();
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
     * Returns CF-IPCountry header value, or null if not behind Cloudflare.
     */
    public String getCountryCode(HttpServletRequest request) {
        return request.getHeader("CF-IPCountry");
    }

    private boolean isTrustedProxy(String remoteAddr) {
        if (trustedProxyIps == null || trustedProxyIps.isBlank()) return false;
        Set<String> trusted = Arrays.stream(trustedProxyIps.split(","))
                .map(String::trim)
                .collect(Collectors.toSet());
        return trusted.contains(remoteAddr);
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
