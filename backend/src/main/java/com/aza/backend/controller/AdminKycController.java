package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.KycAnalyticsResponse;
import com.aza.backend.dto.kyc.KycStatusResponse;
import com.aza.backend.entity.User;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.service.AdminAuditService;
import com.aza.backend.service.AdminService;
import com.aza.backend.service.KycService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/kyc")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE')")
public class AdminKycController {

    private final KycService kycService;
    private final AdminService adminService;
    private final AdminAuditService auditService;
    private final UserRepository userRepository;
    private final com.aza.backend.service.ApprovalService approvalService;
    private final com.aza.backend.service.StaffRoleService staffRoleService;

    @GetMapping("/pending")
    public ResponseEntity<ApiResponse<List<KycStatusResponse>>> getPendingReviews() {
        return ResponseEntity.ok(ApiResponse.success(kycService.getPendingReviews()));
    }

    /** Verified users whose periodic KYC review is overdue (1-year cycle from approval). */
    @GetMapping("/reviews-due")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getReviewsDue() {
        List<Map<String, Object>> due = userRepository
                .findByKycStatusAndKycReviewDueAtBefore(User.KycStatus.VERIFIED, java.time.LocalDateTime.now())
                .stream()
                .map(u -> Map.<String, Object>of(
                        "userId", u.getId().toString(),
                        "name", ((u.getFirstName() != null ? u.getFirstName() : "") + " "
                                + (u.getLastName() != null ? u.getLastName() : "")).trim(),
                        "email", u.getEmail() != null ? u.getEmail() : "",
                        "reviewDueAt", u.getKycReviewDueAt().toString()))
                .toList();
        return ResponseEntity.ok(ApiResponse.success(due));
    }

    @GetMapping("/analytics")
    public ResponseEntity<ApiResponse<KycAnalyticsResponse>> getKycAnalytics() {
        return ResponseEntity.ok(ApiResponse.success(adminService.getKycAnalytics()));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<ApiResponse<KycStatusResponse>> getKycRecord(@PathVariable UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(kycService.getKycStatusForAdmin(userId)));
    }

    @PostMapping("/review/{userId}")
    public ResponseEntity<ApiResponse<Object>> reviewKyc(
            @PathVariable UUID userId,
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal User admin) {

        boolean approve = (boolean) request.getOrDefault("approve", false);
        String reason = (String) request.getOrDefault("reason", "");

        // Maker-checker: approving KYC unlocks transacting, so it needs a second
        // COMPLIANCE/ADMIN. Rejection is protective and stays immediate.
        if (approve && staffRoleService.countActiveStaffUsers() > 1) {
            User kycTarget = userRepository.findById(userId)
                    .orElseThrow(() -> new com.aza.backend.exception.AppException("User not found"));
            return ResponseEntity.ok(ApiResponse.success(approvalService.submit(
                    admin, com.aza.backend.entity.PendingApproval.ActionType.APPROVE_KYC,
                    userId, null, "Approve KYC for " + kycTarget.getEmail())));
        }

        KycStatusResponse result = kycService.reviewRecord(userId, approve, reason);

        User target = userRepository.findById(userId).orElse(null);
        String action = approve ? "APPROVE_KYC" : "REJECT_KYC";
        String details = approve ? "KYC approved" : "KYC rejected. Reason: " + reason;
        auditService.log(admin, action, target, details);

        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
