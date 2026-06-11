package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.ComplianceStatsResponse;
import com.aza.backend.dto.admin.FlaggedTransactionResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.ComplianceService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/compliance")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE')")
public class AdminComplianceController {

    private final ComplianceService complianceService;

    @GetMapping("/flagged")
    public ResponseEntity<ApiResponse<Page<FlaggedTransactionResponse>>> getFlagged(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success(
                complianceService.getFlaggedTransactions(page, size, status)));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<ComplianceStatsResponse>> getStats() {
        return ResponseEntity.ok(ApiResponse.success(complianceService.getStats()));
    }

    @PostMapping("/flagged/{id}/review")
    public ResponseEntity<ApiResponse<FlaggedTransactionResponse>> review(
            @PathVariable UUID id,
            @AuthenticationPrincipal User admin,
            @RequestBody ReviewRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                complianceService.review(id, request.getAction(), request.getNotes(), admin)));
    }

    @Data
    static class ReviewRequest {
        private String action;  // CLEAR or REPORT
        private String notes;
    }
}
