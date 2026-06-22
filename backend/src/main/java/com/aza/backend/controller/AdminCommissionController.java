package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.ApprovalResponse;
import com.aza.backend.dto.agent.SettleCommissionRequest;
import com.aza.backend.entity.AgentCommissionSettlement;
import com.aza.backend.entity.PendingApproval;
import com.aza.backend.entity.User;
import com.aza.backend.service.AgentCommissionService;
import com.aza.backend.service.ApprovalService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Finance back office: settle the commission AZA owes an agent. Payout goes through
 * maker-checker — a second FINANCE/ADMIN must approve before the accrual is reduced.
 * Commission is a payable settled by bank, so no e-money is created.
 */
@RestController
@RequestMapping("/api/v1/admin/commission")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
public class AdminCommissionController {

    private final ApprovalService approvalService;
    private final AgentCommissionService agentCommissionService;

    @PostMapping("/{agentId}/settle")
    public ResponseEntity<ApiResponse<ApprovalResponse>> settle(
            @PathVariable UUID agentId, @RequestBody SettleCommissionRequest request,
            @AuthenticationPrincipal User admin) {
        return ResponseEntity.ok(ApiResponse.success(approvalService.submit(
                admin, PendingApproval.ActionType.SETTLE_COMMISSION, agentId,
                new ApprovalService.CommissionSettlementPayload(request.getAmount(), request.getReference()),
                "Settle GHS " + request.getAmount() + " commission to agent " + agentId)));
    }

    @GetMapping("/settlements")
    public ResponseEntity<ApiResponse<Page<AgentCommissionSettlement>>> settlements(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(agentCommissionService.list(page, size)));
    }
}
