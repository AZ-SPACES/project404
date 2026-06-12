package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.RiskAlertResponse;
import com.aza.backend.dto.admin.RiskStatsResponse;
import com.aza.backend.entity.User;
import com.aza.backend.security.behavior.BehavioralDetectionService;
import com.aza.backend.service.RiskService;
import com.aza.backend.util.RateLimitService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/risk")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE')")
public class AdminRiskController {

    private final RiskService riskService;
    private final RateLimitService rateLimitService;
    private final BehavioralDetectionService behavioralDetection;
    private final com.aza.backend.service.RiskRuleService riskRuleService;

    /** Tunable thresholds driving the transaction risk engine. */
    @GetMapping("/rules")
    public ResponseEntity<ApiResponse<Map<String, String>>> getRules() {
        return ResponseEntity.ok(ApiResponse.success(riskRuleService.getRules()));
    }

    @PatchMapping("/rules")
    public ResponseEntity<ApiResponse<Map<String, String>>> updateRules(
            @RequestBody RiskRulesRequest request,
            @AuthenticationPrincipal User admin) {
        return ResponseEntity.ok(ApiResponse.success(riskRuleService.updateRules(
                admin, request.getLargeTransferGhs(), request.getVelocityMaxHourly())));
    }

    @Data
    static class RiskRulesRequest {
        private String largeTransferGhs;
        private String velocityMaxHourly;
    }

    @GetMapping("/alerts")
    public ResponseEntity<ApiResponse<Page<RiskAlertResponse>>> getAlerts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success(riskService.getAlerts(page, size, severity, status)));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<RiskStatsResponse>> getStats() {
        return ResponseEntity.ok(ApiResponse.success(riskService.getStats()));
    }

    @PatchMapping("/alerts/{id}")
    public ResponseEntity<ApiResponse<RiskAlertResponse>> updateAlert(
            @PathVariable UUID id,
            @AuthenticationPrincipal User admin,
            @RequestBody AlertUpdateRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                riskService.updateAlert(id, request.getStatus(), request.getNotes(), admin)));
    }

    // ==================== RATE LIMIT MANAGEMENT ====================

    /** Reset sliding-window counters + behavioral block for a specific user. */
    @DeleteMapping("/rate-limits/user/{userId}")
    public ResponseEntity<ApiResponse<String>> resetUserRateLimit(@PathVariable UUID userId) {
        rateLimitService.resetUser(userId);
        behavioralDetection.unblock("user:" + userId);
        return ResponseEntity.ok(ApiResponse.success("Rate limits cleared for user " + userId));
    }

    /** Reset sliding-window counters + behavioral block for a specific IP. */
    @DeleteMapping("/rate-limits/ip")
    public ResponseEntity<ApiResponse<String>> resetIpRateLimit(@RequestParam String ip) {
        rateLimitService.resetIp(ip);
        behavioralDetection.unblock("ip:" + ip);
        return ResponseEntity.ok(ApiResponse.success("Rate limits cleared for IP " + ip));
    }

    /** Flush every rate-limit counter in Redis (all users, all IPs, all fingerprints). */
    @DeleteMapping("/rate-limits")
    public ResponseEntity<ApiResponse<Map<String, Long>>> resetAllRateLimits() {
        long deleted = rateLimitService.resetAll();
        return ResponseEntity.ok(ApiResponse.success(Map.of("keysDeleted", deleted)));
    }

    @Data
    static class AlertUpdateRequest {
        private String status;
        private String notes;
    }
}
