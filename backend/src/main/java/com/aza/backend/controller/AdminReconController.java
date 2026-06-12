package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.ReconBreak;
import com.aza.backend.entity.SafeguardingSnapshot;
import com.aza.backend.entity.User;
import com.aza.backend.service.ReconciliationService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/recon")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
public class AdminReconController {

    private final ReconciliationService reconciliationService;

    // ── Safeguarding ──────────────────────────────────────────────────────────

    @GetMapping("/safeguarding")
    public ResponseEntity<ApiResponse<Page<SafeguardingSnapshot>>> safeguardingHistory(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                reconciliationService.snapshotHistory(page, Math.min(size, 50))));
    }

    @PostMapping("/safeguarding")
    public ResponseEntity<ApiResponse<SafeguardingSnapshot>> takeSnapshot(
            @RequestBody SnapshotRequest request,
            @AuthenticationPrincipal User admin) {
        return ResponseEntity.ok(ApiResponse.success(
                reconciliationService.takeSnapshot(admin, request.getSafeguardingBalance())));
    }

    // ── Statement reconciliation ──────────────────────────────────────────────

    @PostMapping("/import")
    public ResponseEntity<ApiResponse<ReconciliationService.ImportResult>> importStatement(
            @RequestBody ImportRequest request,
            @AuthenticationPrincipal User admin) {
        return ResponseEntity.ok(ApiResponse.success(
                reconciliationService.importStatement(admin, request.getLabel(), request.getCsv())));
    }

    @GetMapping("/breaks")
    public ResponseEntity<ApiResponse<Page<ReconBreak>>> listBreaks(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                reconciliationService.listBreaks(status, page, Math.min(size, 50))));
    }

    @GetMapping("/breaks/stats")
    public ResponseEntity<ApiResponse<Map<String, Long>>> breakStats() {
        return ResponseEntity.ok(ApiResponse.success(Map.of("open", reconciliationService.openBreakCount())));
    }

    @PostMapping("/breaks/{id}/resolve")
    public ResponseEntity<ApiResponse<ReconBreak>> resolveBreak(
            @PathVariable UUID id,
            @RequestBody ResolveRequest request,
            @AuthenticationPrincipal User admin) {
        return ResponseEntity.ok(ApiResponse.success(
                reconciliationService.resolveBreak(admin, id, request.getNotes())));
    }

    @Data
    static class SnapshotRequest {
        private BigDecimal safeguardingBalance;
    }

    @Data
    static class ImportRequest {
        private String label;
        private String csv;
    }

    @Data
    static class ResolveRequest {
        private String notes;
    }
}
