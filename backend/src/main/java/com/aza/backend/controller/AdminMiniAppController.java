package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.DisabledMiniAppResponse;
import com.aza.backend.dto.admin.MiniAppReportResponse;
import com.aza.backend.dto.admin.MiniAppReportStatsResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.MiniAppReportService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/miniapps")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminMiniAppController {

    private final MiniAppReportService reportService;

    @GetMapping("/reports")
    public ResponseEntity<ApiResponse<Page<MiniAppReportResponse>>> getReports(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success(reportService.getReports(page, size, status)));
    }

    @GetMapping("/reports/stats")
    public ResponseEntity<ApiResponse<MiniAppReportStatsResponse>> getStats() {
        return ResponseEntity.ok(ApiResponse.success(reportService.getStats()));
    }

    @PostMapping("/reports/{id}/resolve")
    public ResponseEntity<ApiResponse<MiniAppReportResponse>> resolve(
            @PathVariable UUID id,
            @AuthenticationPrincipal User admin,
            @RequestBody ResolveRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                reportService.resolve(id, request.getAction(), request.getResolution(),
                        request.isDisableApp(), admin)));
    }

    @GetMapping("/disabled")
    public ResponseEntity<ApiResponse<List<DisabledMiniAppResponse>>> getDisabledApps() {
        return ResponseEntity.ok(ApiResponse.success(reportService.getDisabledApps()));
    }

    @PostMapping("/{appId}/disable")
    public ResponseEntity<ApiResponse<DisabledMiniAppResponse>> disableApp(
            @PathVariable String appId,
            @AuthenticationPrincipal User admin,
            @RequestBody(required = false) DisableRequest request) {
        String reason = request != null ? request.getReason() : null;
        return ResponseEntity.ok(ApiResponse.success(reportService.disableApp(appId, reason, admin)));
    }

    @PostMapping("/{appId}/enable")
    public ResponseEntity<ApiResponse<Void>> enableApp(@PathVariable String appId) {
        reportService.enableApp(appId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @Data
    static class ResolveRequest {
        private String action;       // RESOLVE or DISMISS
        private String resolution;
        private boolean disableApp;  // when resolving: also disable the reported app
    }

    @Data
    static class DisableRequest {
        private String reason;
    }
}
