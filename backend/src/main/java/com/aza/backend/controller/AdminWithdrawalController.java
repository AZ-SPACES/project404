package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.withdrawal.WithdrawalResponse;
import com.aza.backend.entity.PendingApproval;
import com.aza.backend.entity.User;
import com.aza.backend.entity.UserWithdrawal;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.UserWithdrawalRepository;
import com.aza.backend.service.ApprovalService;
import com.aza.backend.service.StaffRoleService;
import com.aza.backend.service.UserWithdrawalService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/withdrawals")
@RequiredArgsConstructor
// Money leaves the platform here, so this is FINANCE/ADMIN only (not SUPPORT).
@PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
public class AdminWithdrawalController {

    private final UserWithdrawalRepository withdrawalRepository;
    private final UserWithdrawalService withdrawalService;
    private final ApprovalService approvalService;
    private final StaffRoleService staffRoleService;

    public record ReviewRequest(String action, String note) {}

    @GetMapping
    public ResponseEntity<ApiResponse<Page<WithdrawalResponse>>> list(
            @RequestParam(defaultValue = "") String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<UserWithdrawal> result;
        if (status.isBlank()) {
            result = withdrawalRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(page, size));
        } else {
            var s = UserWithdrawal.WithdrawalStatus.valueOf(status.toUpperCase());
            result = withdrawalRepository.findAllByStatusOrderByCreatedAtDesc(s, PageRequest.of(page, size));
        }
        return ResponseEntity.ok(ApiResponse.success(result.map(WithdrawalResponse::from)));
    }

    @PostMapping("/{id}/review")
    public ResponseEntity<ApiResponse<Object>> review(
            @PathVariable UUID id,
            @AuthenticationPrincipal User admin,
            @RequestBody ReviewRequest req) {
        boolean approve = "APPROVE".equalsIgnoreCase(req.action());

        // Approving releases money off-platform → maker-checker: a second FINANCE/ADMIN must
        // confirm, once more than one staff member exists. Rejection refunds the user and is
        // protective, so it stays immediate (mirrors KYC/wallet review).
        if (approve && staffRoleService.countActiveStaffUsers() > 1) {
            UserWithdrawal wd = withdrawalRepository.findById(id)
                    .orElseThrow(() -> new AppException("NOT_FOUND", "Withdrawal not found", HttpStatus.NOT_FOUND));
            if (wd.getStatus() != UserWithdrawal.WithdrawalStatus.PENDING) {
                throw new AppException("ALREADY_REVIEWED",
                        "This withdrawal has already been reviewed", HttpStatus.BAD_REQUEST);
            }
            return ResponseEntity.ok(ApiResponse.success(approvalService.submit(
                    admin, PendingApproval.ActionType.APPROVE_WITHDRAWAL, id,
                    new ApprovalService.ReasonPayload(req.note()),
                    "Approve withdrawal of " + wd.getCurrency() + " " + wd.getAmount()
                            + " to " + wd.getDestination())));
        }

        UserWithdrawal withdrawal = withdrawalService.review(admin, id, req.action(), req.note());
        return ResponseEntity.ok(ApiResponse.success(WithdrawalResponse.from(withdrawal)));
    }
}
