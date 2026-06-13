package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.miniapp.*;
import com.aza.backend.entity.User;
import com.aza.backend.service.MiniAppService;
import jakarta.validation.Valid;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Set;

/**
 * SDK bridge endpoints — called by the native app on behalf of a WebView mini app.
 * Every call carries the user's JWT plus the appId as a path variable so the service
 * can verify consent before returning any data.
 */
@RestController
@RequestMapping("/api/v1/sdk/miniapps/{appId}")
@RequiredArgsConstructor
public class MiniAppSdkController {

    private final MiniAppService miniAppService;

    // ── Consent ────────────────────────────────────────────────────────────

    @GetMapping("/consent")
    public ResponseEntity<ApiResponse<ConsentResponse>> getConsent(
            @PathVariable String appId,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(miniAppService.getConsent(appId, user)));
    }

    @PostMapping("/consent")
    public ResponseEntity<ApiResponse<ConsentResponse>> grantConsent(
            @PathVariable String appId,
            @AuthenticationPrincipal User user,
            @RequestBody GrantConsentRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                miniAppService.grantConsent(appId, request.getPermissions(), user)));
    }

    @DeleteMapping("/consent")
    public ResponseEntity<ApiResponse<Void>> revokeConsent(
            @PathVariable String appId,
            @AuthenticationPrincipal User user) {
        miniAppService.revokeConsent(appId, user);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    // ── SDK data (only callable after consent) ─────────────────────────────

    @GetMapping("/user")
    public ResponseEntity<ApiResponse<SdkUserResponse>> getUser(
            @PathVariable String appId,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(miniAppService.getSdkUser(appId, user)));
    }

    @GetMapping("/balance")
    public ResponseEntity<ApiResponse<Map<String, BigDecimal>>> getBalance(
            @PathVariable String appId,
            @AuthenticationPrincipal User user) {
        BigDecimal balance = miniAppService.getSdkBalance(appId, user);
        return ResponseEntity.ok(ApiResponse.success(Map.of("balance", balance)));
    }

    @PostMapping("/payment")
    public ResponseEntity<ApiResponse<SdkPaymentResponse>> requestPayment(
            @PathVariable String appId,
            @AuthenticationPrincipal User user,
            @Valid @RequestBody SdkPaymentRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                miniAppService.requestSdkPayment(appId, request, user)));
    }

    @Data
    static class GrantConsentRequest {
        private Set<String> permissions;
    }
}
