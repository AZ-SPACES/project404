package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.auth.AuthResponse;
import com.aza.backend.dto.qrlogin.*;
import com.aza.backend.entity.User;
import com.aza.backend.security.fingerprint.RequestFingerprintService;
import com.aza.backend.service.QrLoginService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth/qr-login")
@RequiredArgsConstructor
public class QrLoginController {

    private final QrLoginService qrLoginService;
    private final RequestFingerprintService fingerprinter;

    @PostMapping("/initiate")
    public ResponseEntity<ApiResponse<QrLoginInitiateResponse>> initiate(
            @Valid @RequestBody QrLoginInitiateRequest request) {
        QrLoginInitiateResponse response = qrLoginService.initiateQrLogin(request.getSiteType());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/status/{challengeToken}")
    public ResponseEntity<ApiResponse<QrLoginStatusResponse>> status(
            @PathVariable String challengeToken) {
        QrLoginStatusResponse response = qrLoginService.getStatus(challengeToken);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    // Requires mobile JWT — protected in SecurityConfig before the /api/v1/auth/** permitAll
    @PostMapping("/authorize")
    public ResponseEntity<ApiResponse<Void>> authorize(
            @Valid @RequestBody QrLoginAuthorizeRequest request,
            @AuthenticationPrincipal User user) {
        qrLoginService.authorizeQrLogin(request.getChallengeToken(), user);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/complete")
    public ResponseEntity<ApiResponse<AuthResponse>> complete(
            @Valid @RequestBody QrLoginCompleteRequest request,
            HttpServletRequest httpRequest) {
        String ipAddress = fingerprinter.getClientIp(httpRequest);
        AuthResponse response = qrLoginService.completeQrLogin(
                request.getChallengeToken(), request.getSessionSecret(), ipAddress);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
