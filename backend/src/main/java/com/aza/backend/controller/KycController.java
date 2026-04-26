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
import org.springframework.web.multipart.MultipartFile;


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
            @RequestParam("idType") String idType,
            @RequestParam("idNumber") String idNumber,
            @RequestParam("frontImage") MultipartFile frontImage,
            @RequestParam("backImage") MultipartFile backImage) {

        KycIdentityRequest request = new KycIdentityRequest();
        request.setIdType(idType);
        request.setIdNumber(idNumber);

        return ResponseEntity.ok(ApiResponse.success(
                kycService.submitIdentity(user, request, frontImage, backImage)));
    }

    @PostMapping("/selfie")
    public ResponseEntity<ApiResponse<KycStatusResponse>> submitSelfie(
            @AuthenticationPrincipal User user,
            @RequestParam("selfie") MultipartFile selfie) {
        return ResponseEntity.ok(ApiResponse.success(
                kycService.submitSelfie(user, selfie)));
    }

    @PostMapping("/pep-screening")
    public ResponseEntity<ApiResponse<KycStatusResponse>> submitPepScreening(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody KycPepRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                kycService.submitPepScreening(user, request)));
    }

    @PostMapping("/pep-details")
    public ResponseEntity<ApiResponse<KycStatusResponse>> submitPepDetails(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody KycPepDetailsRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                kycService.submitPepDetails(user, request)));
    }

    @PostMapping("/proof-of-wealth")
    public ResponseEntity<ApiResponse<KycStatusResponse>> submitProofOfWealth(
            @AuthenticationPrincipal User user,
            @RequestParam("document") MultipartFile document) {
        return ResponseEntity.ok(ApiResponse.success(
                kycService.submitProofOfWealth(user, document)));
    }

    @PostMapping("/submit")
    public ResponseEntity<ApiResponse<KycStatusResponse>> submitKyc(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(kycService.submitKyc(user)));
    }
}
