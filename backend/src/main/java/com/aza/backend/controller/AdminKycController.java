package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.kyc.KycStatusResponse;
import com.aza.backend.service.KycService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/kyc")
@RequiredArgsConstructor
public class AdminKycController {

    private final KycService kycService;

    @GetMapping("/pending")
    public ResponseEntity<ApiResponse<List<KycStatusResponse>>> getPendingReviews() {
        return ResponseEntity.ok(ApiResponse.success(kycService.getPendingReviews()));
    }

    @PostMapping("/review/{userId}")
    public ResponseEntity<ApiResponse<KycStatusResponse>> reviewKyc(
            @PathVariable UUID userId,
            @RequestBody Map<String, Object> request) {
        
        boolean approve = (boolean) request.getOrDefault("approve", false);
        String reason = (String) request.getOrDefault("reason", "");

        return ResponseEntity.ok(ApiResponse.success(kycService.reviewRecord(userId, approve, reason)));
    }
}
