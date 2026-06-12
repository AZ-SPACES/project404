package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.AdminWalletResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.AdminAuditService;
import com.aza.backend.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/wallets")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
public class AdminWalletController {

    private final AdminService adminService;
    private final AdminAuditService auditService;
    private final com.aza.backend.service.ApprovalService approvalService;
    private final com.aza.backend.service.StaffRoleService staffRoleService;
    private final com.aza.backend.repository.UserRepository userRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<AdminWalletResponse>>> getWallets(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(adminService.getWallets(page, Math.min(size, 50))));
    }

    /**
     * Freezing is immediate (incident response can't wait on approval);
     * UNfreezing is risk-increasing and goes through maker-checker.
     */
    @PostMapping("/{userId}/freeze")
    public ResponseEntity<ApiResponse<Object>> freezeWallet(
            @PathVariable UUID userId,
            @RequestBody Map<String, Boolean> body,
            @AuthenticationPrincipal User admin) {
        boolean freeze = Boolean.TRUE.equals(body.get("freeze"));
        if (!freeze && staffRoleService.countActiveStaffUsers() > 1) {
            User unfreezeTarget = userRepository.findById(userId)
                    .orElseThrow(() -> new com.aza.backend.exception.AppException("User not found"));
            return ResponseEntity.ok(ApiResponse.success(approvalService.submit(
                    admin, com.aza.backend.entity.PendingApproval.ActionType.UNFREEZE_WALLET,
                    userId, null, "Unfreeze wallet of " + unfreezeTarget.getEmail())));
        }
        AdminWalletResponse response = adminService.freezeWallet(userId, freeze);
        String action = freeze ? "FREEZE_WALLET" : "UNFREEZE_WALLET";
        User target = new User();
        target.setId(userId);
        target.setEmail(response.getUserEmail());
        auditService.log(admin, action, target,
                "walletId=" + response.getWalletId() + " frozen=" + freeze);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
