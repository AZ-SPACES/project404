package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.kyc.*;
import com.aza.backend.entity.User;
import com.aza.backend.service.KycService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/kyc")
@RequiredArgsConstructor
public class KycController {

    private final KycService kycService;

    @GetMapping("/status")
    public ResponseEntity<ApiResponse<KycStatusResponse>> getStatus(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(kycService.getStatus(user)));
    }

    @PostMapping("/consent")
    public ResponseEntity<ApiResponse<KycStatusResponse>> recordConsent(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(kycService.recordConsent(user)));
    }

    @PostMapping("/funds-source")
    public ResponseEntity<ApiResponse<KycStatusResponse>> submitFundsSource(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody KycFundsSourceRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                kycService.submitFundsSource(user, request)));
    }

    @PostMapping("/identity")
    public ResponseEntity<ApiResponse<KycStatusResponse>> submitIdentity(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody KycIdentityRequest request) {
        // TODO: Handle multipart file upload for ID front/back images
        // For now, pass placeholder URLs
        String frontUrl = "placeholder-front-" + System.currentTimeMillis();
        String backUrl = "placeholder-back-" + System.currentTimeMillis();
        return ResponseEntity.ok(ApiResponse.success(
                kycService.submitIdentity(user, request, frontUrl, backUrl)));
    }

    @PostMapping("/selfie")
    public ResponseEntity<ApiResponse<KycStatusResponse>> submitSelfie(
            @AuthenticationPrincipal User user) {
        // TODO: Handle multipart file upload for selfie
        String selfieUrl = "placeholder-selfie-" + System.currentTimeMillis();
        return ResponseEntity.ok(ApiResponse.success(
                kycService.submitSelfie(user, selfieUrl)));
    }

    @PostMapping("/pep-screening")
    public ResponseEntity<ApiResponse<KycStatusResponse>> submitPepScreening(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody KycPepRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                kycService.submitPepScreening(user, request)));
    }

    @PostMapping("/submit")
    public ResponseEntity<ApiResponse<KycStatusResponse>> submitKyc(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(kycService.submitKyc(user)));
    }
}
