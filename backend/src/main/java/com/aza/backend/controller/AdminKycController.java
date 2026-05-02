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
@PreAuthorize("hasRole('ADMIN')")
public class AdminKycController {

    private final KycService kycService;
    private final AdminService adminService;
    private final AdminAuditService auditService;
    private final UserRepository userRepository;

    @GetMapping("/pending")
    public ResponseEntity<ApiResponse<List<KycStatusResponse>>> getPendingReviews() {
        return ResponseEntity.ok(ApiResponse.success(kycService.getPendingReviews()));
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
    public ResponseEntity<ApiResponse<KycStatusResponse>> reviewKyc(
            @PathVariable UUID userId,
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal User admin) {

        boolean approve = (boolean) request.getOrDefault("approve", false);
        String reason = (String) request.getOrDefault("reason", "");

        KycStatusResponse result = kycService.reviewRecord(userId, approve, reason);

        User target = userRepository.findById(userId).orElse(null);
        String action = approve ? "APPROVE_KYC" : "REJECT_KYC";
        String details = approve ? "KYC approved" : "KYC rejected. Reason: " + reason;
        auditService.log(admin, action, target, details);

        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
