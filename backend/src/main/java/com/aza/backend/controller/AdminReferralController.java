package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.Referral;
import com.aza.backend.service.AdminAuditService;
import com.aza.backend.entity.User;
import com.aza.backend.service.ReferralService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/referrals")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','FINANCE','COMPLIANCE')")
public class AdminReferralController {

    private final ReferralService referralService;
    private final AdminAuditService auditService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<Referral>>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                referralService.listAll(page, Math.min(size, 100))));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<Map<String, Object>>> stats() {
        return ResponseEntity.ok(ApiResponse.success(referralService.stats()));
    }

    /** Manually trigger a referral reward (e.g., after KYC approved via admin bulk action). */
    @PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
    @PostMapping("/{referredUserId}/reward")
    public ResponseEntity<ApiResponse<String>> reward(
            @PathVariable UUID referredUserId,
            @AuthenticationPrincipal User admin) {
        referralService.rewardReferrer(referredUserId);
        auditService.log(admin, "REFERRAL_REWARD", null,
                "Manually rewarded referrer for user " + referredUserId);
        return ResponseEntity.ok(ApiResponse.success("Reward applied"));
    }
}
