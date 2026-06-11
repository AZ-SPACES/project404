package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.AdminStatsResponse;
import com.aza.backend.dto.admin.AdminTransactionResponse;
import com.aza.backend.dto.admin.LiveStatsResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/dashboard")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','SUPPORT','COMPLIANCE','FINANCE')")
public class AdminDashboardController {

    private final AdminService adminService;

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<AdminStatsResponse>> getStats() {
        return ResponseEntity.ok(ApiResponse.success(adminService.getStats()));
    }

    @GetMapping("/transactions")
    public ResponseEntity<ApiResponse<Page<AdminTransactionResponse>>> getTransactions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(adminService.getTransactions(page, Math.min(size, 50))));
    }

    @GetMapping("/transactions/{id}")
    public ResponseEntity<ApiResponse<AdminTransactionResponse>> getTransaction(
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(adminService.getTransactionById(id)));
    }

    @GetMapping("/live-stats")
    public ResponseEntity<ApiResponse<LiveStatsResponse>> getLiveStats() {
        return ResponseEntity.ok(ApiResponse.success(adminService.getLiveStats()));
    }

    @PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
    @PostMapping("/transactions/{id}/reverse")
    public ResponseEntity<ApiResponse<AdminTransactionResponse>> reverseTransaction(
            @PathVariable UUID id,
            @AuthenticationPrincipal User admin) {
        return ResponseEntity.ok(ApiResponse.success(adminService.reverseTransaction(id, admin)));
    }
}
