package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.AdminRoleRequest;
import com.aza.backend.dto.admin.AdminUserResponse;
import com.aza.backend.dto.admin.AdminUserStatusRequest;
import com.aza.backend.entity.User;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.service.AdminAuditService;
import com.aza.backend.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final AdminService adminService;
    private final AdminAuditService auditService;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<AdminUserResponse>>> getUsers(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String kycStatus,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                adminService.getUsers(query, status, kycStatus, page, size)));
    }

    @GetMapping("/{userId}")
    public ResponseEntity<ApiResponse<AdminUserResponse>> getUserDetail(@PathVariable UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(adminService.getUserDetail(userId)));
    }

    @PatchMapping("/{userId}/role")
    public ResponseEntity<ApiResponse<AdminUserResponse>> updateUserRole(
            @PathVariable UUID userId,
            @RequestBody AdminRoleRequest request,
            @AuthenticationPrincipal User admin) {
        AdminUserResponse result = adminService.updateUserRole(userId, request.getRole());
        User target = userRepository.findById(userId).orElse(null);
        auditService.log(admin, "CHANGE_ROLE", target,
                "newRole=" + request.getRole());
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PatchMapping("/{userId}/status")
    public ResponseEntity<ApiResponse<AdminUserResponse>> updateUserStatus(
            @PathVariable UUID userId,
            @RequestBody AdminUserStatusRequest request,
            @AuthenticationPrincipal User admin) {
        AdminUserResponse result = adminService.updateUserStatus(userId, request.getStatus(), request.getReason());
        User target = userRepository.findById(userId).orElse(null);
        String action = switch (request.getStatus().toUpperCase()) {
            case "SUSPENDED" -> "SUSPEND_USER";
            case "DEACTIVATED" -> "DEACTIVATE_USER";
            default -> "ACTIVATE_USER";
        };
        String details = "status=" + request.getStatus();
        if (request.getReason() != null && !request.getReason().isBlank()) {
            details += " reason=" + request.getReason();
        }
        auditService.log(admin, action, target, details);
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
