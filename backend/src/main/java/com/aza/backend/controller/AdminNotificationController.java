package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.BroadcastNotificationRequest;
import com.aza.backend.entity.PendingApproval;
import com.aza.backend.entity.User;
import com.aza.backend.service.AdminAuditService;
import com.aza.backend.service.ApprovalService;
import com.aza.backend.service.BroadcastNotificationService;
import com.aza.backend.service.StaffRoleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/notifications")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminNotificationController {

    private final AdminAuditService auditService;
    private final BroadcastNotificationService broadcastNotificationService;
    private final ApprovalService approvalService;
    private final StaffRoleService staffRoleService;

    /** Maker-checker: pushing to every user's phone needs a second ADMIN. */
    @PostMapping("/broadcast")
    public ResponseEntity<ApiResponse<Object>> broadcast(
            @RequestBody BroadcastNotificationRequest request,
            @AuthenticationPrincipal User admin) {

        String audience = request.getAudience() != null ? request.getAudience().toUpperCase() : "ALL";

        if (staffRoleService.countActiveStaffUsers() > 1) {
            return ResponseEntity.ok(ApiResponse.success(approvalService.submit(
                    admin, PendingApproval.ActionType.BROADCAST_NOTIFICATION,
                    admin.getId(), request,
                    "Broadcast \"" + request.getTitle() + "\" to " + audience)));
        }

        int sent = broadcastNotificationService.broadcast(request);
        auditService.log(admin, "BROADCAST_NOTIFICATION", null,
                "audience=" + audience + " title=" + request.getTitle() + " recipients=" + sent);
        return ResponseEntity.ok(ApiResponse.success(Map.of("sent", sent)));
    }
}
