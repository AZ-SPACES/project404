package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.AdminTransactionResponse;
import com.aza.backend.dto.transfer.TransferResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.AdminAuditService;
import com.aza.backend.service.AdminService;
import com.aza.backend.service.FraudAiService;
import com.aza.backend.service.TransferService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE')")
public class AdminAiController {

    private final AdminService adminService;
    private final TransferService transferService;
    private final AdminAuditService auditService;
    private final FraudAiService fraudAiService;

    @GetMapping("/fraud/flagged")
    public ResponseEntity<ApiResponse<Page<AdminTransactionResponse>>> getFlaggedTransactions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String riskLevel) {
        return ResponseEntity.ok(ApiResponse.success(
                adminService.getFlaggedTransactions(riskLevel, page, size)));
    }

    // ── Held-for-review transfers (HIGH anomaly interception) ────────────────

    @GetMapping("/fraud/held")
    public ResponseEntity<ApiResponse<Page<AdminTransactionResponse>>> getHeldTransfers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                adminService.getHeldTransactions(page, Math.min(size, 50))));
    }

    @PostMapping("/fraud/held/{id}/release")
    public ResponseEntity<ApiResponse<TransferResponse>> releaseHeld(
            @PathVariable UUID id,
            @AuthenticationPrincipal User admin) {
        TransferResponse result = transferService.releaseHeldTransfer(id);
        auditService.log(admin, "RELEASE_HELD_TRANSFER", null, "transactionId=" + id);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /** On-demand Claude second opinion on a held transfer; verdict is stored on the decision log. */
    @PostMapping("/fraud/held/{id}/ai-opinion")
    public ResponseEntity<ApiResponse<FraudAiService.Assessment>> aiOpinion(
            @PathVariable UUID id,
            @AuthenticationPrincipal User admin) {
        FraudAiService.Assessment assessment = fraudAiService.assessHeldTransfer(id);
        auditService.log(admin, "AI_FRAUD_ASSESSMENT", null,
                "transactionId=" + id + " verdict=" + assessment.verdict());
        return ResponseEntity.ok(ApiResponse.success(assessment));
    }

    @PostMapping("/fraud/held/{id}/reject")
    public ResponseEntity<ApiResponse<TransferResponse>> rejectHeld(
            @PathVariable UUID id,
            @AuthenticationPrincipal User admin) {
        TransferResponse result = transferService.rejectHeldTransfer(id);
        auditService.log(admin, "REJECT_HELD_TRANSFER", null, "transactionId=" + id);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/analytics/categories")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getCategoryBreakdown(
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(ApiResponse.success(
                adminService.getCategoryBreakdown(days)));
    }
}
