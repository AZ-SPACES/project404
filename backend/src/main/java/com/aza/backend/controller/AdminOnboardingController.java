package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.KycRecord;
import com.aza.backend.entity.User;
import com.aza.backend.repository.KycRecordRepository;
import com.aza.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/analytics/onboarding")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','FINANCE','COMPLIANCE')")
public class AdminOnboardingController {

    private final UserRepository userRepository;
    private final KycRecordRepository kycRecordRepository;

    @GetMapping("/funnel")
    public ResponseEntity<ApiResponse<Map<String, Object>>> funnel() {
        long totalSignedUp = userRepository.count();

        // Users who started KYC (kycStatus != NOT_STARTED)
        long kycNotStarted = userRepository.countByKycStatus(User.KycStatus.NOT_STARTED);
        long kycStarted = totalSignedUp - kycNotStarted;

        // Docs submitted = records in kyc_records table
        long docsSubmitted = kycRecordRepository.count();

        // Under review
        long underReview = kycRecordRepository.countByStatus(KycRecord.KycStatus.UNDER_REVIEW);

        // Verified
        long kycVerified = userRepository.countByKycStatus(User.KycStatus.VERIFIED);

        // Rejected
        long kycRejected = userRepository.countByKycStatus(User.KycStatus.REJECTED);

        // Pending review
        long kycPending = kycRecordRepository.countByStatus(KycRecord.KycStatus.PENDING);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalSignedUp", totalSignedUp);
        result.put("kycStarted", kycStarted);
        result.put("docsSubmitted", docsSubmitted);
        result.put("underReview", underReview);
        result.put("kycPending", kycPending);
        result.put("kycVerified", kycVerified);
        result.put("kycRejected", kycRejected);

        // Drop-off rates
        if (totalSignedUp > 0) {
            result.put("kycStartedRate", Math.round(kycStarted * 100.0 / totalSignedUp));
            result.put("docsSubmittedRate", Math.round(docsSubmitted * 100.0 / totalSignedUp));
            result.put("verifiedRate", Math.round(kycVerified * 100.0 / totalSignedUp));
        } else {
            result.put("kycStartedRate", 0);
            result.put("docsSubmittedRate", 0);
            result.put("verifiedRate", 0);
        }

        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
