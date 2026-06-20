package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.withdrawal.WithdrawalResponse;
import com.aza.backend.entity.User;
import com.aza.backend.entity.UserWithdrawal;
import com.aza.backend.repository.UserWithdrawalRepository;
import com.aza.backend.service.UserWithdrawalService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
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
    public ResponseEntity<ApiResponse<WithdrawalResponse>> review(
            @PathVariable UUID id,
            @AuthenticationPrincipal User admin,
            @RequestBody ReviewRequest req) {
        UserWithdrawal withdrawal = withdrawalService.review(admin, id, req.action(), req.note());
        return ResponseEntity.ok(ApiResponse.success(WithdrawalResponse.from(withdrawal)));
    }
}
