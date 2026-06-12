package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.ApprovalResponse;
import com.aza.backend.dto.admin.FeeRuleResponse;
import com.aza.backend.dto.admin.FeeStatsResponse;
import com.aza.backend.entity.PendingApproval;
import com.aza.backend.entity.User;
import com.aza.backend.service.ApprovalService;
import com.aza.backend.service.FeeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/fees")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
public class AdminFeeController {

    private final FeeService feeService;
    private final ApprovalService approvalService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<FeeRuleResponse>>> getFeeRules() {
        return ResponseEntity.ok(ApiResponse.success(feeService.getFeeRules()));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<FeeStatsResponse>> getStats() {
        return ResponseEntity.ok(ApiResponse.success(feeService.getStats()));
    }

    /** Maker-checker: fee changes hit revenue directly, so a second FINANCE/ADMIN must approve. */
    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<ApprovalResponse>> updateRule(
            @PathVariable UUID id,
            @RequestBody FeeService.FeeRuleUpdateRequest request,
            @AuthenticationPrincipal User admin) {
        return ResponseEntity.ok(ApiResponse.success(approvalService.submit(
                admin, PendingApproval.ActionType.UPDATE_FEE_RULE, id, request,
                "Update fee rule " + id + " (amount=" + request.getAmount()
                        + ", active=" + request.getActive() + ")")));
    }
}
