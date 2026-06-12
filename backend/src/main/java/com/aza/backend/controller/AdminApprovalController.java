package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.ApprovalResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.ApprovalService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Maker-checker queue. Eligibility to approve a given action (owning role +
 * not the requester) is enforced in ApprovalService, not here.
 */
@RestController
@RequestMapping("/api/v1/admin/approvals")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','FINANCE','COMPLIANCE')")
public class AdminApprovalController {

    private final ApprovalService approvalService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<ApprovalResponse>>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(approvalService.list(status, page, Math.min(size, 50))));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Long>>> stats() {
        return ResponseEntity.ok(ApiResponse.success(Map.of("pending", approvalService.pendingCount())));
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<ApiResponse<ApprovalResponse>> approve(
            @PathVariable UUID id,
            @RequestBody(required = false) ReviewRequest request,
            @AuthenticationPrincipal User approver) {
        return ResponseEntity.ok(ApiResponse.success(
                approvalService.approve(approver, id, request != null ? request.getNotes() : null)));
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<ApiResponse<ApprovalResponse>> reject(
            @PathVariable UUID id,
            @RequestBody(required = false) ReviewRequest request,
            @AuthenticationPrincipal User reviewer) {
        return ResponseEntity.ok(ApiResponse.success(
                approvalService.reject(reviewer, id, request != null ? request.getNotes() : null)));
    }

    @Data
    static class ReviewRequest {
        private String notes;
    }
}
