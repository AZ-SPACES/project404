package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.StaffMemberResponse;
import com.aza.backend.entity.PendingApproval;
import com.aza.backend.entity.StaffRole;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.service.ApprovalService;
import com.aza.backend.service.StaffRoleService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** Staff role grants/revocations. ADMIN-only: handing out back-office power is itself the most sensitive power. */
@RestController
@RequestMapping("/api/v1/admin/staff")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminStaffController {

    private final StaffRoleService staffRoleService;
    private final ApprovalService approvalService;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<StaffMemberResponse>>> listStaff() {
        return ResponseEntity.ok(ApiResponse.success(staffRoleService.listStaff()));
    }

    /**
     * Maker-checker: grants go through approvals (minting power is the most
     * sensitive action there is). Bootstrap exception: while only one staff
     * member exists there is nobody to approve, so the grant executes directly —
     * otherwise the second staff member could never be added.
     */
    @PostMapping("/{userId}/roles")
    public ResponseEntity<ApiResponse<Object>> grantRole(
            @PathVariable UUID userId,
            @RequestBody RoleRequest request,
            @AuthenticationPrincipal User admin) {
        StaffRole.Role role = parseRole(request.getRole());
        if (staffRoleService.countActiveStaffUsers() <= 1) {
            return ResponseEntity.ok(ApiResponse.success(
                    staffRoleService.grantRole(admin, userId, role)));
        }
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new AppException("USER_NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));
        return ResponseEntity.ok(ApiResponse.success(approvalService.submit(
                admin, PendingApproval.ActionType.GRANT_STAFF_ROLE, userId,
                new ApprovalService.GrantRolePayload(role.name()),
                "Grant " + role + " to " + target.getEmail())));
    }

    /** Atomic swap (grant new + revoke old in one transaction); maker-checker with the same bootstrap exception. */
    @PostMapping("/{userId}/change-role")
    public ResponseEntity<ApiResponse<Object>> changeRole(
            @PathVariable UUID userId,
            @RequestBody ChangeRoleRequest request,
            @AuthenticationPrincipal User admin) {
        StaffRole.Role fromRole = parseRole(request.getFromRole());
        StaffRole.Role toRole = parseRole(request.getToRole());
        if (staffRoleService.countActiveStaffUsers() <= 1) {
            return ResponseEntity.ok(ApiResponse.success(
                    staffRoleService.changeRole(admin, userId, fromRole, toRole)));
        }
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new AppException("USER_NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));
        return ResponseEntity.ok(ApiResponse.success(approvalService.submit(
                admin, PendingApproval.ActionType.CHANGE_STAFF_ROLE, userId,
                new ApprovalService.ChangeRolePayload(fromRole.name(), toRole.name()),
                "Change " + target.getEmail() + " from " + fromRole + " to " + toRole)));
    }

    @DeleteMapping("/{userId}/roles/{role}")
    public ResponseEntity<ApiResponse<StaffMemberResponse>> revokeRole(
            @PathVariable UUID userId,
            @PathVariable String role,
            @AuthenticationPrincipal User admin) {
        return ResponseEntity.ok(ApiResponse.success(
                staffRoleService.revokeRole(admin, userId, parseRole(role))));
    }

    private StaffRole.Role parseRole(String role) {
        try {
            return StaffRole.Role.valueOf(role.toUpperCase());
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new AppException("INVALID_ROLE", "Unknown staff role: " + role, HttpStatus.BAD_REQUEST);
        }
    }

    @Data
    static class RoleRequest {
        private String role;
    }

    @Data
    static class ChangeRoleRequest {
        private String fromRole;
        private String toRole;
    }
}
