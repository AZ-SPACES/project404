package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.AdminRoleRequest;
import com.aza.backend.dto.admin.AdminUserResponse;
import com.aza.backend.dto.admin.AdminUserStatusRequest;
import com.aza.backend.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final AdminService adminService;

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
            @RequestBody AdminRoleRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                adminService.updateUserRole(userId, request.getRole())));
    }

    @PatchMapping("/{userId}/status")
    public ResponseEntity<ApiResponse<AdminUserResponse>> updateUserStatus(
            @PathVariable UUID userId,
            @RequestBody AdminUserStatusRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                adminService.updateUserStatus(userId, request.getStatus(), request.getReason())));
    }
}
