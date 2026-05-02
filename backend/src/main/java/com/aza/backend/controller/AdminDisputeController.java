package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.DisputeResponse;
import com.aza.backend.dto.admin.DisputeStatsResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.DisputeService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/disputes")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminDisputeController {

    private final DisputeService disputeService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<DisputeResponse>>> getDisputes(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success(disputeService.getDisputes(page, size, status)));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<DisputeStatsResponse>> getStats() {
        return ResponseEntity.ok(ApiResponse.success(disputeService.getStats()));
    }

    @PostMapping("/{id}/resolve")
    public ResponseEntity<ApiResponse<DisputeResponse>> resolve(
            @PathVariable UUID id,
            @AuthenticationPrincipal User admin,
            @RequestBody ResolveRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                disputeService.resolve(id, request.getAction(), request.getResolution(), admin)));
    }

    @Data
    static class ResolveRequest {
        private String action;      // APPROVE or DENY
        private String resolution;
    }
}
