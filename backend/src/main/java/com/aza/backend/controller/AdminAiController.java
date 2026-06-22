package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.AdminTransactionResponse;
import com.aza.backend.dto.ai.AiUsageOverview;
import com.aza.backend.dto.ai.AiUsageUserRow;
import com.aza.backend.dto.transfer.TransferResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.AdminAuditService;
import com.aza.backend.service.AdminService;
import com.aza.backend.service.AiUsageService;
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
    private final AiUsageService aiUsageService;

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

    @PostMapping("/fraud/pending/{id}/cancel")
    public ResponseEntity<ApiResponse<TransferResponse>> cancelPending(
            @PathVariable UUID id,
            @AuthenticationPrincipal User admin) {
        TransferResponse result = transferService.cancelPendingTransfer(id);
        auditService.log(admin, "CANCEL_PENDING_TRANSFER", null, "transactionId=" + id);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/analytics/categories")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getCategoryBreakdown(
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(ApiResponse.success(
                adminService.getCategoryBreakdown(days)));
    }

    // ── AI assistant usage (metadata-only monitoring; no chat content stored) ────

    @GetMapping("/ai/usage")
    public ResponseEntity<ApiResponse<AiUsageOverview>> getAiUsageOverview(
            @RequestParam(defaultValue = "30") int days) {
        return ResponseEntity.ok(ApiResponse.success(
                aiUsageService.getOverview(clampDays(days))));
    }

    @GetMapping("/ai/usage/users")
    public ResponseEntity<ApiResponse<List<AiUsageUserRow>>> getAiUsageTopUsers(
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(defaultValue = "50") int limit) {
        return ResponseEntity.ok(ApiResponse.success(
                aiUsageService.getTopUsers(clampDays(days), Math.min(Math.max(limit, 1), 200))));
    }

    /** Disable the AI assistant for a user (kill switch). */
    @PostMapping("/ai/users/{userId}/disable")
    public ResponseEntity<ApiResponse<Void>> disableUserAi(
            @PathVariable UUID userId, @AuthenticationPrincipal User admin) {
        User target = aiUsageService.setAiDisabled(userId, true);
        auditService.log(admin, "AI_DISABLE_USER", target, "userId=" + userId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    /** Re-enable the AI assistant for a user. */
    @PostMapping("/ai/users/{userId}/enable")
    public ResponseEntity<ApiResponse<Void>> enableUserAi(
            @PathVariable UUID userId, @AuthenticationPrincipal User admin) {
        User target = aiUsageService.setAiDisabled(userId, false);
        auditService.log(admin, "AI_ENABLE_USER", target, "userId=" + userId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    /** Clear a user's hourly + daily AI quota counters. */
    @PostMapping("/ai/users/{userId}/reset-quota")
    public ResponseEntity<ApiResponse<Void>> resetUserAiQuota(
            @PathVariable UUID userId, @AuthenticationPrincipal User admin) {
        aiUsageService.resetQuota(userId);
        auditService.log(admin, "AI_RESET_QUOTA", null, "userId=" + userId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    private int clampDays(int days) {
        return Math.min(Math.max(days, 1), 365);
    }
}
