package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.ApprovalResponse;
import com.aza.backend.dto.agent.AgentResponse;
import com.aza.backend.dto.agent.AgentTermsRequest;
import com.aza.backend.entity.PendingApproval;
import com.aza.backend.entity.User;
import com.aza.backend.service.AgentService;
import com.aza.backend.service.ApprovalService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Back office agent management. Approval goes through maker-checker (a second
 * COMPLIANCE/ADMIN must approve); rejection and suspension are immediate, like
 * KYC rejection and wallet freezing.
 */
@RestController
@RequestMapping("/api/v1/admin/agents")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE')")
public class AdminAgentController {

    private final AgentService agentService;
    private final ApprovalService approvalService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<AgentResponse>>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(agentService.list(status, page, size)));
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<ApiResponse<ApprovalResponse>> approve(
            @PathVariable UUID id, @AuthenticationPrincipal User admin) {
        return ResponseEntity.ok(ApiResponse.success(approvalService.submit(
                admin, PendingApproval.ActionType.APPROVE_AGENT, id, null, "Activate agent " + id)));
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<ApiResponse<AgentResponse>> reject(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(agentService.reject(id)));
    }

    @PostMapping("/{id}/suspend")
    public ResponseEntity<ApiResponse<AgentResponse>> suspend(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(agentService.suspend(id)));
    }

    /** Changing an agent's tier/float-limit/commission is maker-checker — a second COMPLIANCE/ADMIN must confirm. */
    @PostMapping("/{id}/terms")
    public ResponseEntity<ApiResponse<ApprovalResponse>> updateTerms(
            @PathVariable UUID id, @RequestBody AgentTermsRequest request, @AuthenticationPrincipal User admin) {
        return ResponseEntity.ok(ApiResponse.success(approvalService.submit(
                admin, PendingApproval.ActionType.UPDATE_AGENT_TERMS, id, request,
                "Update terms for agent " + id)));
    }
}
