package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.ComplianceStatsResponse;
import com.aza.backend.dto.admin.FlaggedTransactionResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.ComplianceService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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

    @GetMapping(value = "/flagged/export", produces = "text/csv")
    public ResponseEntity<String> exportFlagged(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) {
        List<FlaggedTransactionResponse> all = complianceService.getAllFlaggedForExport(status, from, to);
        StringBuilder csv = new StringBuilder("id,transactionId,userId,userName,amount,currency,flagReason,riskScore,status,flaggedAt,reviewedAt,reviewedBy,notes\n");
        for (FlaggedTransactionResponse f : all) {
            csv.append(esc(f.getId())).append(",")
               .append(esc(f.getTransactionId())).append(",")
               .append(esc(f.getUserId())).append(",")
               .append(esc(f.getUserName())).append(",")
               .append(f.getAmount()).append(",")
               .append(esc(f.getCurrency())).append(",")
               .append(esc(f.getFlagReason())).append(",")
               .append(f.getRiskScore()).append(",")
               .append(esc(f.getStatus())).append(",")
               .append(esc(f.getFlaggedAt() != null ? f.getFlaggedAt().toString() : "")).append(",")
               .append(esc(f.getReviewedAt() != null ? f.getReviewedAt().toString() : "")).append(",")
               .append(esc(f.getReviewedBy())).append(",")
               .append(esc(f.getNotes())).append("\n");
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"aml-register.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv.toString());
    }

    private static String esc(String v) {
        if (v == null) return "";
        if (v.contains(",") || v.contains("\"") || v.contains("\n")) return "\"" + v.replace("\"", "\"\"") + "\"";
        return v;
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
