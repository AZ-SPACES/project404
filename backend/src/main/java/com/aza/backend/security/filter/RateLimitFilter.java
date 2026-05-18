package com.aza.backend.security.filter;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.User;
import com.aza.backend.exception.RateLimitExceededException;
import com.aza.backend.security.behavior.BehavioralDetectionService;
import com.aza.backend.security.challenge.ChallengeService;
import com.aza.backend.security.fingerprint.RequestFingerprintService;
import com.aza.backend.security.reputation.IpReputationService;
import com.aza.backend.util.RateLimitService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;

/**
 * Multi-dimensional rate limiting and abuse detection filter.
 *
 * Runs AFTER JwtAuthenticationFilter so SecurityContext is already populated.
 * Checks are applied in order of cheapest-to-most-expensive:
 *
 *   1. IP reputation (Redis key lookup)              → 403 if blocked
 *   2. Geo-block via CF-IPCountry header             → 403 if blocked country
 *   3. Behavioral block (IP or fingerprint)          → 429 with Retry-After
 *   4. Bypass token check (verified CAPTCHA clients) → skip remaining checks
 *   5. IP-level rate limit (coarse, per-IP)          → 429
 *   6. Fingerprint-level rate limit (per-device)     → 429
 *   7. User-level rate limit (per JWT subject)       → 429
 *   8. Burst detection + suspicion scoring           → 429 if auto-blocked
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RateLimitFilter extends OncePerRequestFilter {

    private final RateLimitService rateLimitService;
    private final BehavioralDetectionService behavioralDetection;
    private final IpReputationService ipReputation;
    private final RequestFingerprintService fingerprinter;
    private final ChallengeService challengeService;
    private final ObjectMapper objectMapper;

    // ── Rate limit tiers ───────────────────────────────────────────────────────
    // Auth endpoints are intentionally stricter to resist credential stuffing.

    @Value("${app.ratelimit.ip.limit:200}")
    private int ipLimit;
    @Value("${app.ratelimit.ip.window-seconds:60}")
    private int ipWindowSeconds;

    @Value("${app.ratelimit.ip.auth-limit:30}")
    private int authIpLimit;
    @Value("${app.ratelimit.ip.auth-window-seconds:900}")
    private int authIpWindowSeconds;

    @Value("${app.ratelimit.fingerprint.limit:150}")
    private int fingerprintLimit;
    @Value("${app.ratelimit.fingerprint.window-seconds:60}")
    private int fingerprintWindowSeconds;

    @Value("${app.ratelimit.user.limit:500}")
    private int userLimit;
    @Value("${app.ratelimit.user.window-seconds:60}")
    private int userWindowSeconds;

    // Burst: how many req/5s before suspicion points are added
    @Value("${app.ratelimit.burst.threshold:20}")
    private int burstThreshold;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        // Never rate-limit WebSocket upgrades or actuator probes
        return path.startsWith("/ws") || path.startsWith("/actuator");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String ip = fingerprinter.getClientIp(request);
        String fingerprint = fingerprinter.getDeviceFingerprint(request);
        String path = request.getRequestURI();
        boolean isAuthPath = path.startsWith("/api/v1/auth/");

        // ── 1. IP reputation ──────────────────────────────────────────────────
        if (ipReputation.isBlocked(ip)) {
            rejectAccess(response, "Your IP address has been blocked.");
            return;
        }

        // ── 2. Geo-block (Cloudflare CF-IPCountry) ────────────────────────────
        String country = fingerprinter.getCountryCode(request);
        if (country != null && ipReputation.isCountryBlocked(country)) {
            rejectAccess(response, "Access from your region is not available.");
            return;
        }

        // ── 3. Behavioral block ───────────────────────────────────────────────
        String ipActorKey = "ip:" + ip;
        String fpActorKey = "fp:" + fingerprint;

        if (behavioralDetection.isBlocked(ipActorKey)) {
            long ttl = behavioralDetection.getBlockTtlSeconds(ipActorKey);
            rejectRateLimit(response, "Too many suspicious requests. Try again later.", ttl);
            return;
        }
        if (behavioralDetection.isBlocked(fpActorKey)) {
            long ttl = behavioralDetection.getBlockTtlSeconds(fpActorKey);
            rejectRateLimit(response, "Suspicious activity detected. Try again later.", ttl);
            return;
        }

        // ── 4. Bypass check (client completed CAPTCHA challenge) ──────────────
        String bypassToken = request.getHeader("X-Bypass-Token");
        boolean hasVerifiedBypass = challengeService.hasBypass(ipActorKey, bypassToken)
                || challengeService.hasBypass(fpActorKey, bypassToken);

        if (!hasVerifiedBypass) {
            // ── 5. IP-level rate limit ─────────────────────────────────────────
            try {
                if (isAuthPath) {
                    rateLimitService.enforceRateLimit(
                            "ip_auth:" + ip, authIpLimit, Duration.ofSeconds(authIpWindowSeconds));
                } else {
                    rateLimitService.enforceRateLimit(
                            "ip:" + ip, ipLimit, Duration.ofSeconds(ipWindowSeconds));
                }
            } catch (RateLimitExceededException e) {
                escalateSuspicion(ipActorKey, 10, ip, "IP rate limit exceeded");
                rejectRateLimit(response, e.getMessage(), e.getRetryAfterSeconds());
                return;
            }

            // ── 6. Fingerprint-level rate limit ───────────────────────────────
            try {
                rateLimitService.enforceRateLimit(
                        "fp:" + fingerprint, fingerprintLimit, Duration.ofSeconds(fingerprintWindowSeconds));
            } catch (RateLimitExceededException e) {
                escalateSuspicion(fpActorKey, 15, fingerprint, "fingerprint rate limit exceeded");
                rejectRateLimit(response, e.getMessage(), e.getRetryAfterSeconds());
                return;
            }

            // ── 7. User-level rate limit (JWT subject, if authenticated) ───────
            // JwtAuthenticationFilter ran before this filter, so SecurityContext is populated.
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getPrincipal() instanceof User user) {
                String userActorKey = "user:" + user.getId();
                if (behavioralDetection.isBlocked(userActorKey)) {
                    long ttl = behavioralDetection.getBlockTtlSeconds(userActorKey);
                    rejectRateLimit(response, "Account temporarily restricted. Try again later.", ttl);
                    return;
                }
                try {
                    rateLimitService.enforceRateLimit(
                            userActorKey, userLimit, Duration.ofSeconds(userWindowSeconds));
                } catch (RateLimitExceededException e) {
                    escalateSuspicion(userActorKey, 5, user.getId().toString(), "user rate limit exceeded");
                    rejectRateLimit(response, e.getMessage(), e.getRetryAfterSeconds());
                    return;
                }
            }

            // ── 8. Burst detection ────────────────────────────────────────────
            long burstCount = behavioralDetection.trackRequest(ipActorKey);
            if (burstCount > burstThreshold) {
                boolean nowBlocked = behavioralDetection.reportSuspiciousEvent(ipActorKey, 5);
                if (nowBlocked) {
                    long ttl = behavioralDetection.getBlockTtlSeconds(ipActorKey);
                    rejectRateLimit(response, "Burst traffic detected. Slow down.", ttl);
                    return;
                }
            }
        }

        // ── Set informational headers ─────────────────────────────────────────
        long remaining = rateLimitService.getRemainingCount("ip:" + ip, ipLimit, Duration.ofSeconds(ipWindowSeconds));
        response.setHeader("X-RateLimit-Limit", String.valueOf(ipLimit));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(remaining));

        chain.doFilter(request, response);

        // Post-response: record auth failures for behavioral scoring
        int status = response.getStatus();
        if (isAuthPath && (status == 401 || status == 400)) {
            long failures = behavioralDetection.recordFailure(ipActorKey);
            if (failures >= 10) {
                // 10 auth failures in 15 min → escalate suspicion
                behavioralDetection.reportSuspiciousEvent(ipActorKey, 20);
                log.warn("High auth failure rate from IP {} ({}x in window)", ip, failures);
            }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void escalateSuspicion(String actorKey, int points, String id, String reason) {
        boolean blocked = behavioralDetection.reportSuspiciousEvent(actorKey, points);
        if (blocked) {
            log.warn("Auto-blocked {} ({}) — {}", actorKey, id, reason);
        }
    }

    private void rejectAccess(HttpServletResponse response, String message) throws IOException {
        response.setStatus(403);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getWriter(),
                ApiResponse.error("ACCESS_DENIED", message));
    }

    private void rejectRateLimit(HttpServletResponse response, String message, long retryAfterSeconds) throws IOException {
        response.setStatus(429);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));
        response.setHeader("X-Challenge-Available", "true"); // hint: CAPTCHA can bypass
        objectMapper.writeValue(response.getWriter(),
                ApiResponse.error("RATE_LIMIT_EXCEEDED", message));
    }
}
