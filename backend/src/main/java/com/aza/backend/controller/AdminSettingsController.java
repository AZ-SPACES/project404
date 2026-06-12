package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.SystemSettingsResponse;
import com.aza.backend.entity.PendingApproval;
import com.aza.backend.entity.User;
import com.aza.backend.service.ApprovalService;
import com.aza.backend.service.StaffRoleService;
import com.aza.backend.service.SystemSettingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/settings")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminSettingsController {

    private final SystemSettingService settingService;
    private final ApprovalService approvalService;
    private final StaffRoleService staffRoleService;

    @GetMapping
    public ResponseEntity<ApiResponse<SystemSettingsResponse>> getSettings() {
        return ResponseEntity.ok(ApiResponse.success(settingService.getSettings()));
    }

    /**
     * Maker-checker: settings changes (maintenance mode, limits, blocked
     * countries) need a second ADMIN — except while only one staff member
     * exists, when there is nobody to approve.
     */
    @PatchMapping
    public ResponseEntity<ApiResponse<Object>> updateSettings(
            @RequestBody SystemSettingService.SystemSettingsRequest request,
            @AuthenticationPrincipal User admin) {
        if (staffRoleService.countActiveStaffUsers() <= 1) {
            return ResponseEntity.ok(ApiResponse.success(settingService.updateSettings(request)));
        }
        return ResponseEntity.ok(ApiResponse.success(approvalService.submit(
                admin, PendingApproval.ActionType.UPDATE_SYSTEM_SETTINGS,
                admin.getId(), request, "Update system settings"
                        + (request.getMaintenanceMode() != null ? " (maintenanceMode=" + request.getMaintenanceMode() + ")" : ""))));
    }
}
