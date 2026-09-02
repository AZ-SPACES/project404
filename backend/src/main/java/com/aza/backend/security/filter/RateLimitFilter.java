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
 *
 * Actor scoping — this is the key design principle:
 *   - Authenticated requests  → tracked and blocked PER USER.
 *     A user's burst/block never spills onto other users at the same IP.
 *   - Unauthenticated requests WITH X-Device-ID → tracked and blocked PER DEVICE,
 *     with a loose per-IP backstop. Required by CGNAT: Ghanaian carriers front
 *     hundreds of real users with one public IP, so an IP-keyed limit throttles
 *     strangers together and an IP-keyed auto-block takes out the whole carrier.
 *   - Unauthenticated requests WITHOUT one → tracked and blocked PER IP, strictly.
 *     A caller that presents no device identity is the credential-stuffing shape.
 *
 * Check order (cheapest → most expensive):
 *   1. IP reputation (persistent block set by admin)         → 403
 *   2. Geo-block via CF-IPCountry header                     → 403
 *   -- global kill switch (admin) short-circuits 3–11 --
 *   3. User behavioral block (authenticated only)            → 429  [before bypass]
 *   4. IP behavioral block (unauthenticated, no device id)   → 429
 *   5. Fingerprint behavioral block                          → 429
 *   6. Bypass token check (client completed CAPTCHA)         → skip 7–10
 *   7. Auth-path limit: per-device + loose IP, else per-IP   → 429
 *   8. Unauthenticated non-auth limit: same split            → 429
 *   9. Fingerprint rate limit                                → 429
 *  10. User rate limit (authenticated requests)              → 429
 *  11. Burst detection (user → device → IP, first available) → 429 if auto-blocked
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

    @Value("${app.ratelimit.enabled:true}")
    private boolean rateLimitEnabled;

    @Value("${app.ratelimit.ip.limit:150}")
    private int ipLimit;
    @Value("${app.ratelimit.ip.window-seconds:60}")
    private int ipWindowSeconds;

    @Value("${app.ratelimit.ip.auth-limit:200}")
    private int authIpLimit;
    @Value("${app.ratelimit.ip.auth-window-seconds:900}")
    private int authIpWindowSeconds;

    // Applied per device instead of per IP when the caller sends X-Device-ID. Tighter
    // than the IP limit it replaces, because it now covers one install rather than a
    // whole carrier: a real signup or login is a handful of calls, not sixty.
    @Value("${app.ratelimit.device.auth-limit:60}")
    private int authDeviceLimit;

    // Coarse backstop kept over the shared IP so one host flooding auth endpoints is
    // still capped. Sized for a carrier NAT fronting many real users, not for one user.
    @Value("${app.ratelimit.ip.shared-auth-limit:2000}")
    private int sharedAuthIpLimit;
    @Value("${app.ratelimit.ip.shared-limit:1500}")
    private int sharedIpLimit;

    @Value("${app.ratelimit.fingerprint.limit:300}")
    private int fingerprintLimit;
    @Value("${app.ratelimit.fingerprint.window-seconds:60}")
    private int fingerprintWindowSeconds;

    @Value("${app.ratelimit.user.limit:500}")
    private int userLimit;
    @Value("${app.ratelimit.user.window-seconds:60}")
    private int userWindowSeconds;

    @Value("${app.ratelimit.burst.threshold:40}")
    private int burstThreshold;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (!rateLimitEnabled) {
            return true;
        }
        String path = request.getRequestURI();
        // Skip WS, actuator, and QR-status polling (polled every 2 s — would exhaust the auth-path IP bucket).
        return path.startsWith("/ws")
                || path.startsWith("/actuator")
                || path.startsWith("/api/v1/auth/qr-login/status/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        try {
            doRateLimitInternal(request, response, chain);
        } catch (org.springframework.dao.DataAccessException e) {
            log.error("Rate-limit infrastructure error — failing open: {}", e.getMessage());
            chain.doFilter(request, response);
        }
    }

    private void doRateLimitInternal(HttpServletRequest request,
                                     HttpServletResponse response,
                                     FilterChain chain) throws ServletException, IOException {
        String ip = fingerprinter.getClientIp(request);
        String fingerprint = fingerprinter.getDeviceFingerprint(request);
        String path = request.getRequestURI();
        boolean isAuthPath = path.startsWith("/api/v1/auth/");

        String ipActorKey = "ip:" + ip;
        String fpActorKey = "fp:" + fingerprint;

        // Ghanaian carriers run CGNAT: hundreds of unrelated users share one public IP.
        // Keying an unauthenticated limit on that IP therefore pools strangers into one
        // bucket — the whole carrier trips a limit that no single user came close to, and
        // burst detection can block every AZA user on that network at once. When the
        // caller sends X-Device-ID we have a per-install key that does not collide, so it
        // becomes the actor and the IP keeps only a loose backstop.
        boolean stableDevice = fingerprinter.hasStableDeviceId(request);
        String unauthActorKey = stableDevice ? fpActorKey : ipActorKey;

        // Resolve the authenticated user — JwtAuthenticationFilter already ran.
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        User authenticatedUser = (auth != null && auth.getPrincipal() instanceof User u) ? u : null;
        String userActorKey = authenticatedUser != null ? "user:" + authenticatedUser.getId() : null;

        // ── 1. IP reputation (admin-set permanent block) ──────────────────────
        if (ipReputation.isBlocked(ip)) {
            rejectAccess(response, "Your IP address has been blocked.");
            return;
        }

        // ── 2. Geo-block (Cloudflare CF-IPCountry) ────────────────────────────
        String country = fingerprinter.getCountryCode(request);
        if (country != null && ipReputation.isCountryBlocked(country)) {
            rejectGeoBlock(response);
            return;
        }

        // ── Global kill switch (admin break-glass) ────────────────────────────
        // Skips every throttle and behavioural block below — including blocks that were already
        // handed out — so flipping the switch actually unblocks whoever is stuck. Deliberately
        // placed AFTER the IP-reputation and geo checks: those are access-control decisions, not
        // rate limiting, and must survive the switch.
        if (rateLimitService.isGloballyDisabled()) {
            response.setHeader("X-RateLimit-Bypass", "global-switch");
            chain.doFilter(request, response);
            return;
        }

        // ── 3. User behavioral block ──────────────────────────────────────────
        // Checked BEFORE the bypass token so a CAPTCHA pass cannot lift a user-level block.
        if (userActorKey != null && behavioralDetection.isBlocked(userActorKey)) {
            long ttl = behavioralDetection.getBlockTtlSeconds(userActorKey);
            rejectRateLimit(response, "Account temporarily restricted. Try again later.", ttl);
            return;
        }

        // ── 4. IP behavioral block (unauthenticated traffic only) ────────────
        // Authenticated users have valid JWTs and are bounded by their own per-user
        // limits (steps 10–11). Applying an IP block to them would cause collateral
        // damage to every user behind a shared NAT (corporate, mobile carrier, etc.).
        // Only when the IP is genuinely this caller's actor. For a client with its own
        // device identity the block belongs on the fingerprint (step 5) — an automatic
        // block on a CGNAT address would take out every AZA user on that carrier.
        // Deliberate blocks are unaffected: admin IP reputation is step 1.
        if (authenticatedUser == null && !stableDevice && behavioralDetection.isBlocked(ipActorKey)) {
            long ttl = behavioralDetection.getBlockTtlSeconds(ipActorKey);
            rejectRateLimit(response, "Too many suspicious requests. Try again later.", ttl);
            return;
        }

        // ── 5. Fingerprint behavioral block ───────────────────────────────────
        if (behavioralDetection.isBlocked(fpActorKey)) {
            long ttl = behavioralDetection.getBlockTtlSeconds(fpActorKey);
            rejectRateLimit(response, "Suspicious activity detected. Try again later.", ttl);
            return;
        }

        // ── 6. Bypass check (client completed CAPTCHA challenge) ──────────────
        String bypassToken = request.getHeader("X-Bypass-Token");
        boolean hasVerifiedBypass = challengeService.hasBypass(ipActorKey, bypassToken)
                || challengeService.hasBypass(fpActorKey, bypassToken);

        if (!hasVerifiedBypass) {
            // ── 7. Auth-path IP rate limit ────────────────────────────────────
            // Always enforced per-IP on /auth/** to resist credential stuffing,
            // regardless of whether the caller has a JWT.
            if (isAuthPath) {
                try {
                    if (stableDevice) {
                        rateLimitService.enforceRateLimit(
                                "auth_device:" + fingerprint, authDeviceLimit,
                                Duration.ofSeconds(authIpWindowSeconds));
                        rateLimitService.enforceRateLimit(
                                "ip_auth_shared:" + ip, sharedAuthIpLimit,
                                Duration.ofSeconds(authIpWindowSeconds));
                    } else {
                        // No device identity to bind to — fall back to the strict per-IP
                        // limit, which is what resists credential stuffing from scripts.
                        rateLimitService.enforceRateLimit(
                                "ip_auth:" + ip, authIpLimit, Duration.ofSeconds(authIpWindowSeconds));
                    }
                } catch (RateLimitExceededException e) {
                    escalateSuspicion(unauthActorKey, 10,
                            stableDevice ? fingerprint : ip, "auth rate limit exceeded");
                    rejectRateLimit(response, e.getMessage(), e.getRetryAfterSeconds());
                    return;
                }
            }

            // ── 8. IP rate limit (unauthenticated non-auth requests only) ─────
            // Authenticated requests are not IP-rate-limited here — they hit the
            // per-user limit in step 10 instead. This prevents a burst from one
            // account from consuming IP quota shared by other accounts.
            if (!isAuthPath && authenticatedUser == null) {
                try {
                    if (stableDevice) {
                        // Per-device volume is already bounded by step 9; the IP keeps only
                        // a backstop so a NAT full of real users is not throttled as one.
                        rateLimitService.enforceRateLimit(
                                "ip_shared:" + ip, sharedIpLimit, Duration.ofSeconds(ipWindowSeconds));
                    } else {
                        rateLimitService.enforceRateLimit(
                                "ip:" + ip, ipLimit, Duration.ofSeconds(ipWindowSeconds));
                    }
                } catch (RateLimitExceededException e) {
                    escalateSuspicion(unauthActorKey, 10,
                            stableDevice ? fingerprint : ip, "IP rate limit exceeded");
                    rejectRateLimit(response, e.getMessage(), e.getRetryAfterSeconds());
                    return;
                }
            }

            // ── 9. Fingerprint-level rate limit ───────────────────────────────
            try {
                rateLimitService.enforceRateLimit(
                        "fp:" + fingerprint, fingerprintLimit, Duration.ofSeconds(fingerprintWindowSeconds));
            } catch (RateLimitExceededException e) {
                escalateSuspicion(fpActorKey, 15, fingerprint, "fingerprint rate limit exceeded");
                rejectRateLimit(response, e.getMessage(), e.getRetryAfterSeconds());
                return;
            }

            // ── 10. User rate limit ───────────────────────────────────────────
            if (userActorKey != null && authenticatedUser != null) {
                try {
                    rateLimitService.enforceRateLimit(
                            userActorKey, userLimit, Duration.ofSeconds(userWindowSeconds));
                } catch (RateLimitExceededException e) {
                    escalateSuspicion(userActorKey, 5, authenticatedUser.getId().toString(), "user rate limit exceeded");
                    rejectRateLimit(response, e.getMessage(), e.getRetryAfterSeconds());
                    return;
                }
            }

            // ── 11. Burst detection ───────────────────────────────────────────
            // Track against the user when authenticated, the device when the caller has
            // an identity, and only then the IP. That ordering is the "shared IP" fix:
            // a burst is attributed to whoever actually made it, so it never blocks
            // every other account or install behind the same carrier NAT.
            String burstActorKey = userActorKey != null ? userActorKey : unauthActorKey;
            long burstCount = behavioralDetection.trackRequest(burstActorKey);
            if (burstCount > burstThreshold) {
                boolean nowBlocked = behavioralDetection.reportSuspiciousEvent(burstActorKey, 5);
                if (nowBlocked) {
                    long ttl = behavioralDetection.getBlockTtlSeconds(burstActorKey);
                    rejectRateLimit(response, "Burst traffic detected. Slow down.", ttl);
                    return;
                }
            }
        }

        // ── Set informational rate-limit headers ──────────────────────────────
        // Report whichever limit actually applies to this caller.
        if (userActorKey != null) {
            long remaining = rateLimitService.getRemainingCount(
                    userActorKey, userLimit, Duration.ofSeconds(userWindowSeconds));
            response.setHeader("X-RateLimit-Limit", String.valueOf(userLimit));
            response.setHeader("X-RateLimit-Remaining", String.valueOf(remaining));
        } else if (stableDevice) {
            long remaining = rateLimitService.getRemainingCount(
                    fpActorKey, fingerprintLimit, Duration.ofSeconds(fingerprintWindowSeconds));
            response.setHeader("X-RateLimit-Limit", String.valueOf(fingerprintLimit));
            response.setHeader("X-RateLimit-Remaining", String.valueOf(remaining));
        } else {
            long remaining = rateLimitService.getRemainingCount(
                    "ip:" + ip, ipLimit, Duration.ofSeconds(ipWindowSeconds));
            response.setHeader("X-RateLimit-Limit", String.valueOf(ipLimit));
            response.setHeader("X-RateLimit-Remaining", String.valueOf(remaining));
        }

        chain.doFilter(request, response);

        // Post-response: record auth failures for behavioral scoring. A failed login has
        // no authenticated user, so it is scored against the device when the caller has
        // one and the IP otherwise. Scoring every failure to the IP was the sharpest edge
        // of the CGNAT problem on this path: mistyped passwords are ordinary, ten of them
        // across a carrier is an afternoon, and the resulting auto-block would lock every
        // AZA user on that network out of logging in.
        int status = response.getStatus();
        if (isAuthPath && (status == 401 || status == 400)) {
            long failures = behavioralDetection.recordFailure(unauthActorKey);
            if (failures >= 10) {
                behavioralDetection.reportSuspiciousEvent(unauthActorKey, 20);
                log.warn("High auth failure rate from {} ({}x in window)", unauthActorKey, failures);
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

    private void rejectGeoBlock(HttpServletResponse response) throws IOException {
        response.setStatus(403);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getWriter(),
                ApiResponse.error("GEO_RESTRICTED", "AZA is not available in your region."));
    }

    private void rejectRateLimit(HttpServletResponse response, String message, long retryAfterSeconds) throws IOException {
        response.setStatus(429);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));
        response.setHeader("X-Challenge-Available", "true");
        objectMapper.writeValue(response.getWriter(),
                ApiResponse.error("RATE_LIMIT_EXCEEDED", message));
    }
}
