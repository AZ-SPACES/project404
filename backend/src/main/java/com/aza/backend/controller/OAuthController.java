package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.oauth.*;
import com.aza.backend.dto.qrlogin.QrLoginInitiateResponse;
import com.aza.backend.dto.qrlogin.QrLoginStatusResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.OAuthService;
import com.aza.backend.service.QrLoginService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/oauth")
@RequiredArgsConstructor
public class OAuthController {

    private final OAuthService    oAuthService;
    private final QrLoginService  qrLoginService;

    // ── Public client info ────────────────────────────────────────────────────

    @GetMapping("/clients/{clientId}")
    public ResponseEntity<ApiResponse<OAuthPublicClientResponse>> getClientInfo(
            @PathVariable String clientId) {
        return ResponseEntity.ok(ApiResponse.success(oAuthService.getPublicClientInfo(clientId)));
    }

    // ── PKCE / redirect flow ──────────────────────────────────────────────────

    /**
     * Step 1: third-party server validates params and gets a pendingState.
     * Returns the AZA consent URL the user should be redirected to.
     */
    @PostMapping("/authorize")
    public ResponseEntity<ApiResponse<String>> authorize(
            @Valid @RequestBody OAuthAuthorizeRequest request) {
        String pendingState = oAuthService.initiateAuthorize(request);
        String consentUrl   = "https://aza.systems/oauth/consent?state=" + pendingState;
        return ResponseEntity.ok(ApiResponse.success(consentUrl));
    }

    /**
     * Called by the consent page to load app info before showing the login form.
     * Public — no auth required.
     */
    @GetMapping("/pending/{state}")
    public ResponseEntity<ApiResponse<OAuthService.PendingConsentInfo>> getPendingConsent(
            @PathVariable String state) {
        return ResponseEntity.ok(ApiResponse.success(oAuthService.getPendingConsentInfo(state)));
    }

    /**
     * Called by the consent page after the user enters their Aza credentials.
     * Authenticates the user, approves consent, and returns the redirect URL.
     * Public — credentials are verified server-side.
     */
    @PostMapping("/approve")
    public ResponseEntity<ApiResponse<String>> approveConsent(
            @RequestParam String state,
            @RequestParam String identifier,
            @RequestParam String password) {
        String redirectUrl = oAuthService.approveConsentWithCredentials(state, identifier, password);
        return ResponseEntity.ok(ApiResponse.success(redirectUrl));
    }

    // ── Token exchange ────────────────────────────────────────────────────────

    @PostMapping("/token")
    public ResponseEntity<OAuthTokenResponse> token(
            @Valid @RequestBody OAuthTokenRequest request) {
        OAuthTokenResponse response = oAuthService.exchangeToken(request);
        return ResponseEntity.ok(response);
    }

    // ── Userinfo ──────────────────────────────────────────────────────────────

    @GetMapping("/userinfo")
    public ResponseEntity<OAuthUserInfoResponse> userInfo(
            @RequestHeader("Authorization") String authHeader) {
        String token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
        return ResponseEntity.ok(oAuthService.getUserInfo(token));
    }

    // ── Revoke ────────────────────────────────────────────────────────────────

    @PostMapping("/revoke")
    public ResponseEntity<Void> revoke(
            @RequestParam String clientId,
            @RequestParam String clientSecret,
            @RequestParam String token) {
        oAuthService.revokeToken(clientId, clientSecret, token);
        return ResponseEntity.ok().build();
    }

    // ── QR flow ───────────────────────────────────────────────────────────────

    @PostMapping("/qr/initiate")
    public ResponseEntity<ApiResponse<QrLoginInitiateResponse>> qrInitiate(
            @Valid @RequestBody OAuthQrInitiateRequest request) {
        QrLoginInitiateResponse response = qrLoginService.initiateOAuthQrLogin(
                request.getClientId(), request.getClientSecret(), request.getScopes());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/qr/status/{challengeToken}")
    public ResponseEntity<ApiResponse<QrLoginStatusResponse>> qrStatus(
            @PathVariable String challengeToken) {
        return ResponseEntity.ok(ApiResponse.success(qrLoginService.getStatus(challengeToken)));
    }

    @PostMapping("/qr/complete")
    public ResponseEntity<OAuthTokenResponse> qrComplete(
            @Valid @RequestBody OAuthQrCompleteRequest request) {
        OAuthTokenResponse response = qrLoginService.completeOAuthQrLogin(
                request.getChallengeToken(), request.getSessionSecret(),
                request.getClientId(), request.getClientSecret());
        return ResponseEntity.ok(response);
    }

    // ── Connected apps (user-facing, requires AZA JWT) ────────────────────────

    @GetMapping("/connected-apps")
    public ResponseEntity<ApiResponse<List<ConnectedAppResponse>>> getConnectedApps(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(oAuthService.getConnectedApps(user)));
    }

    @DeleteMapping("/connected-apps/{clientId}")
    public ResponseEntity<ApiResponse<Void>> revokeConnectedApp(
            @PathVariable String clientId,
            @AuthenticationPrincipal User user) {
        oAuthService.revokeConnectedApp(user, clientId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
