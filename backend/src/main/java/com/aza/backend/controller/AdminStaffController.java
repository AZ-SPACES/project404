package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.StaffMemberResponse;
import com.aza.backend.entity.StaffRole;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
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

    @GetMapping
    public ResponseEntity<ApiResponse<List<StaffMemberResponse>>> listStaff() {
        return ResponseEntity.ok(ApiResponse.success(staffRoleService.listStaff()));
    }

    @PostMapping("/{userId}/roles")
    public ResponseEntity<ApiResponse<StaffMemberResponse>> grantRole(
            @PathVariable UUID userId,
            @RequestBody RoleRequest request,
            @AuthenticationPrincipal User admin) {
        return ResponseEntity.ok(ApiResponse.success(
                staffRoleService.grantRole(admin, userId, parseRole(request.getRole()))));
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
}
