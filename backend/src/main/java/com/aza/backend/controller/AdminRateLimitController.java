package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.AuditLog;
import com.aza.backend.entity.RateLimitConfig;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.RateLimitConfigRepository;
import com.aza.backend.service.AuditService;
import com.aza.backend.util.RateLimitService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/rate-limits")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Slf4j
public class AdminRateLimitController {

    /** Hard ceiling on how long the kill switch may stay off in one go (24 h). */
    private static final int MAX_DISABLE_MINUTES = 24 * 60;

    private final RateLimitConfigRepository rateLimitConfigRepository;
    private final RateLimitService rateLimitService;
    private final AuditService auditService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<RateLimitConfig>>> listAll() {
        return ResponseEntity.ok(ApiResponse.success(
                rateLimitConfigRepository.findAllByOrderByCreatedAtDesc()));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<RateLimitConfig>> create(@RequestBody RateLimitConfigRequest body) {
        RateLimitConfig config = RateLimitConfig.builder()
                .endpointPattern(body.endpointPattern())
                .description(body.description())
                .maxRequests(body.maxRequests())
                .windowSeconds(body.windowSeconds())
                .scope(body.scope())
                .enabled(body.enabled() != null ? body.enabled() : true)
                .build();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(rateLimitConfigRepository.save(config)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<RateLimitConfig>> update(
            @PathVariable UUID id,
            @RequestBody RateLimitConfigRequest body) {
        RateLimitConfig config = rateLimitConfigRepository.findById(id)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Rate limit config not found", HttpStatus.NOT_FOUND));
        config.setEndpointPattern(body.endpointPattern());
        config.setDescription(body.description());
        config.setMaxRequests(body.maxRequests());
        config.setWindowSeconds(body.windowSeconds());
        config.setScope(body.scope());
        if (body.enabled() != null) config.setEnabled(body.enabled());
        return ResponseEntity.ok(ApiResponse.success(rateLimitConfigRepository.save(config)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        if (!rateLimitConfigRepository.existsById(id)) {
            throw new AppException("NOT_FOUND", "Rate limit config not found", HttpStatus.NOT_FOUND);
        }
        rateLimitConfigRepository.deleteById(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{id}/toggle")
    public ResponseEntity<ApiResponse<RateLimitConfig>> toggle(@PathVariable UUID id) {
        RateLimitConfig config = rateLimitConfigRepository.findById(id)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Rate limit config not found", HttpStatus.NOT_FOUND));
        config.setEnabled(!config.isEnabled());
        return ResponseEntity.ok(ApiResponse.success(rateLimitConfigRepository.save(config)));
    }

    // ==================== GLOBAL KILL SWITCH ====================
    // Break-glass control for incidents where the throttles themselves are the problem
    // (a bad limit shipped, a partner integration getting 429s, load testing). While off,
    // every per-IP/user/fingerprint limit and behavioural block is bypassed platform-wide.
    // IP-reputation blocks and geo-restrictions are NOT affected.

    @GetMapping("/global")
    public ResponseEntity<ApiResponse<GlobalSwitchResponse>> getGlobalSwitch() {
        return ResponseEntity.ok(ApiResponse.success(currentSwitchState()));
    }

    /**
     * Turns rate limiting off (or back on) for the entire platform.
     *
     * @param body {@code disabled} — true switches limiting OFF; {@code minutes} — optional
     *             auto-re-enable window (1–1440). Omit for "off until switched back on".
     */
    @PostMapping("/global")
    public ResponseEntity<ApiResponse<GlobalSwitchResponse>> setGlobalSwitch(
            @RequestBody GlobalSwitchRequest body,
            @AuthenticationPrincipal User admin,
            HttpServletRequest httpRequest) {

        boolean disabled = Boolean.TRUE.equals(body.disabled());
        Duration ttl = null;
        if (disabled && body.minutes() != null) {
            if (body.minutes() < 1 || body.minutes() > MAX_DISABLE_MINUTES) {
                throw new AppException("INVALID_DURATION",
                        "Duration must be between 1 and " + MAX_DISABLE_MINUTES + " minutes",
                        HttpStatus.BAD_REQUEST);
            }
            ttl = Duration.ofMinutes(body.minutes());
        }

        rateLimitService.setGloballyDisabled(disabled, ttl);

        String detail = disabled
                ? "Rate limiting disabled platform-wide" + (ttl != null ? " for " + body.minutes() + " min" : " indefinitely")
                : "Rate limiting re-enabled platform-wide";
        log.warn("{} by admin {}", detail, admin != null ? admin.getEmail() : "unknown");
        auditService.logWithDetails(AuditLog.RATE_LIMIT_SWITCH_CHANGED, AuditLog.SUCCESS,
                admin != null ? admin.getId() : null,
                admin != null ? admin.getEmail() : null,
                httpRequest.getRemoteAddr(), detail);

        return ResponseEntity.ok(ApiResponse.success(currentSwitchState()));
    }

    private GlobalSwitchResponse currentSwitchState() {
        boolean disabled = rateLimitService.isGloballyDisabled();
        return new GlobalSwitchResponse(disabled, disabled ? rateLimitService.getGlobalDisableTtlSeconds() : -1);
    }

    /** @param expiresInSeconds seconds until limiting re-arms itself; -1 when it never will. */
    record GlobalSwitchResponse(boolean disabled, long expiresInSeconds) {}

    record GlobalSwitchRequest(Boolean disabled, Integer minutes) {}

    record RateLimitConfigRequest(
            String endpointPattern,
            String description,
            int maxRequests,
            int windowSeconds,
            String scope,
            Boolean enabled
    ) {}
}
