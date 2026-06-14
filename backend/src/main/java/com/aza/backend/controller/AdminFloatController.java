package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.ApprovalResponse;
import com.aza.backend.dto.admin.FloatRequest;
import com.aza.backend.entity.FloatMovement;
import com.aza.backend.entity.PendingApproval;
import com.aza.backend.entity.User;
import com.aza.backend.service.ApprovalService;
import com.aza.backend.service.FloatService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Finance back office: mint/burn agent float. Both go through maker-checker — a
 * second FINANCE/ADMIN must approve before any e-money is created or destroyed.
 */
@RestController
@RequestMapping("/api/v1/admin/float")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
public class AdminFloatController {

    private final ApprovalService approvalService;
    private final FloatService floatService;

    @PostMapping("/{agentId}/mint")
    public ResponseEntity<ApiResponse<ApprovalResponse>> mint(
            @PathVariable UUID agentId, @RequestBody FloatRequest request,
            @AuthenticationPrincipal User admin) {
        return ResponseEntity.ok(ApiResponse.success(approvalService.submit(
                admin, PendingApproval.ActionType.MINT_FLOAT, agentId,
                new ApprovalService.FloatMovementPayload(request.getAmount(), request.getReference()),
                "Mint GHS " + request.getAmount() + " float to agent " + agentId)));
    }

    @PostMapping("/{agentId}/burn")
    public ResponseEntity<ApiResponse<ApprovalResponse>> burn(
            @PathVariable UUID agentId, @RequestBody FloatRequest request,
            @AuthenticationPrincipal User admin) {
        return ResponseEntity.ok(ApiResponse.success(approvalService.submit(
                admin, PendingApproval.ActionType.BURN_FLOAT, agentId,
                new ApprovalService.FloatMovementPayload(request.getAmount(), request.getReference()),
                "Burn GHS " + request.getAmount() + " float from agent " + agentId)));
    }

    @GetMapping("/movements")
    public ResponseEntity<ApiResponse<Page<FloatMovement>>> movements(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(floatService.list(page, size)));
    }
}
