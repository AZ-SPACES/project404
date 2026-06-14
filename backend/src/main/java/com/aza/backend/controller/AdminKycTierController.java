package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.SetKycTierRequest;
import com.aza.backend.entity.KycTier;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.service.AdminAuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/** Back office: set a user's KYC tier, which drives their transaction caps and wallet ceiling. */
@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE')")
public class AdminKycTierController {

    private final UserRepository userRepository;
    private final AdminAuditService auditService;

    @PostMapping("/{id}/kyc-tier")
    public ResponseEntity<ApiResponse<Map<String, String>>> setTier(
            @PathVariable UUID id, @RequestBody SetKycTierRequest request,
            @AuthenticationPrincipal User admin) {
        if (request.getTier() == null || request.getTier().isBlank()) {
            throw new AppException("INVALID_TIER", "A tier is required", HttpStatus.BAD_REQUEST);
        }
        KycTier tier;
        try {
            tier = KycTier.valueOf(request.getTier().trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException("INVALID_TIER",
                    "Tier must be one of TIER_1, TIER_2, TIER_3", HttpStatus.BAD_REQUEST);
        }
        User target = userRepository.findById(id)
                .orElseThrow(() -> new AppException("NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));
        target.setKycTier(tier);
        userRepository.save(target);
        auditService.log(admin, "UPDATE_KYC_TIER", target, "tier=" + tier);
        return ResponseEntity.ok(ApiResponse.success(Map.of("kycTier", tier.name())));
    }
}
