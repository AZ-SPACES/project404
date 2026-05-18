package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.RiskAlertResponse;
import com.aza.backend.dto.admin.RiskStatsResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.RiskService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/risk")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminRiskController {

    private final RiskService riskService;

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

    @Data
    static class AlertUpdateRequest {
        private String status;
        private String notes;
    }
}
