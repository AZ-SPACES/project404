package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.AdminMiniAppResponse;
import com.aza.backend.dto.admin.DisabledMiniAppResponse;
import com.aza.backend.dto.admin.MiniAppReportResponse;
import com.aza.backend.dto.admin.MiniAppReportStatsResponse;
import com.aza.backend.dto.miniapp.MiniAppDetailResponse;
import com.aza.backend.entity.DisabledMiniApp;
import com.aza.backend.entity.User;
import com.aza.backend.service.MiniAppReportService;
import com.aza.backend.service.MiniAppService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
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
    private final MiniAppService miniAppService;
    private final com.aza.backend.service.ApprovalService approvalService;
    private final com.aza.backend.service.StaffRoleService staffRoleService;

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

    /** Full catalog with each app's current status (ACTIVE | MAINTENANCE | DISABLED). */
    @GetMapping
    public ResponseEntity<ApiResponse<List<AdminMiniAppResponse>>> getAllApps() {
        return ResponseEntity.ok(ApiResponse.success(reportService.getAllAppsForAdmin()));
    }

    @GetMapping("/disabled")
    public ResponseEntity<ApiResponse<List<DisabledMiniAppResponse>>> getDisabledApps() {
        return ResponseEntity.ok(ApiResponse.success(reportService.getDisabledApps()));
    }

    /** Put an app under maintenance; all users get a push + in-app notification. */
    @PostMapping("/{appId}/maintenance")
    public ResponseEntity<ApiResponse<AdminMiniAppResponse>> setMaintenance(
            @PathVariable String appId,
            @AuthenticationPrincipal User admin,
            @RequestBody(required = false) MaintenanceRequest request) {
        String message = request != null ? request.getMessage() : null;
        return ResponseEntity.ok(ApiResponse.success(reportService.setMaintenance(appId, message, admin)));
    }

    @PostMapping("/{appId}/disable")
    public ResponseEntity<ApiResponse<DisabledMiniAppResponse>> disableApp(
            @PathVariable String appId,
            @AuthenticationPrincipal User admin,
            @RequestBody(required = false) DisableRequest request) {
        String reason = request != null ? request.getReason() : null;
        return ResponseEntity.ok(ApiResponse.success(reportService.disableApp(appId, reason, admin)));
    }

    /**
     * Maker-checker: re-enabling a killed app needs a second ADMIN. Ending
     * maintenance is routine ops and takes effect immediately, as does disabling.
     */
    @PostMapping("/{appId}/enable")
    public ResponseEntity<ApiResponse<Object>> enableApp(
            @PathVariable String appId,
            @AuthenticationPrincipal User admin) {
        boolean isMaintenance = reportService.getStatusRecord(appId)
                .map(d -> d.getStatus() == DisabledMiniApp.Status.MAINTENANCE)
                .orElse(false);
        if (!isMaintenance && staffRoleService.countActiveStaffUsers() > 1) {
            return ResponseEntity.ok(ApiResponse.success(approvalService.submit(
                    admin, com.aza.backend.entity.PendingApproval.ActionType.ENABLE_MINI_APP,
                    admin.getId(),
                    new com.aza.backend.service.ApprovalService.EnableMiniAppPayload(appId),
                    "Re-enable mini app \"" + appId + "\"")));
        }
        reportService.enableApp(appId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    // ── Developer app review ───────────────────────────────────────────────

    @GetMapping("/submissions")
    public ResponseEntity<ApiResponse<Page<MiniAppDetailResponse>>> getSubmissions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(miniAppService.getSubmissions(page, size)));
    }

    @PostMapping("/submissions/{appId}/approve")
    public ResponseEntity<ApiResponse<MiniAppDetailResponse>> approve(
            @PathVariable String appId,
            @AuthenticationPrincipal User admin) {
        return ResponseEntity.ok(ApiResponse.success(miniAppService.approve(appId, admin)));
    }

    @PostMapping("/submissions/{appId}/reject")
    public ResponseEntity<ApiResponse<MiniAppDetailResponse>> reject(
            @PathVariable String appId,
            @AuthenticationPrincipal User admin,
            @Valid @RequestBody RejectRequest request) {
        return ResponseEntity.ok(ApiResponse.success(miniAppService.reject(appId, request.getReason(), admin)));
    }

    @PostMapping("/submissions/{appId}/suspend")
    public ResponseEntity<ApiResponse<MiniAppDetailResponse>> suspend(
            @PathVariable String appId,
            @AuthenticationPrincipal User admin,
            @Valid @RequestBody RejectRequest request) {
        return ResponseEntity.ok(ApiResponse.success(miniAppService.suspend(appId, request.getReason(), admin)));
    }

    @Data
    static class RejectRequest {
        @NotBlank
        private String reason;
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

    @Data
    static class MaintenanceRequest {
        private String message; // shown to users in the notification and the hub
    }
}
