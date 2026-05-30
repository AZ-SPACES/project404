package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.AdminTransactionResponse;
import com.aza.backend.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminAiController {

    private final AdminService adminService;

    @GetMapping("/fraud/flagged")
    public ResponseEntity<ApiResponse<Page<AdminTransactionResponse>>> getFlaggedTransactions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String riskLevel) {
        return ResponseEntity.ok(ApiResponse.success(
                adminService.getFlaggedTransactions(riskLevel, page, size)));
    }

    @GetMapping("/analytics/categories")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getCategoryBreakdown(
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(ApiResponse.success(
                adminService.getCategoryBreakdown(days)));
    }
}
