package com.aza.backend.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.oauth.*;
import com.aza.backend.dto.qrlogin.QrLoginInitiateResponse;
import com.aza.backend.dto.qrlogin.QrLoginStatusResponse;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.service.OAuthService;
import com.aza.backend.service.QrLoginService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/oauth")
@RequiredArgsConstructor
@Tag(name = "Sign in with AZA", description = "OAuth 2.0 authorize, token and userinfo for partner sign-in")
public class OAuthController {

    private final OAuthService    oAuthService;
    private final QrLoginService  qrLoginService;

    private static final String CONSENT_BASE = "https://aza.systems/oauth/consent?state=";

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
        String consentUrl   = CONSENT_BASE + pendingState;
        return ResponseEntity.ok(ApiResponse.success(consentUrl));
    }

    /**
     * Standard OAuth 2.0 authorization endpoint (RFC 6749 §3.1) — the browser
     * GET that off-the-shelf OAuth/plugin clients build:
     *   GET /oauth/authorize?response_type=code&client_id=…&redirect_uri=…&scope=…&state=…
     *
     * Runs the same validation as the POST variant and 302-redirects the user's
     * browser to the AZA consent page. Errors are rendered inline rather than
     * reflected to redirect_uri, to avoid an open-redirect via an unregistered URI.
     */
    @GetMapping("/authorize")
    public ResponseEntity<?> authorizeBrowser(
            @RequestParam(value = "response_type", required = false) String responseType,
            @RequestParam(value = "client_id",     required = false) String clientId,
            @RequestParam(value = "redirect_uri",  required = false) String redirectUri,
            @RequestParam(value = "scope",         required = false) String scope,
            @RequestParam(value = "state",         required = false) String state,
            @RequestParam(value = "code_challenge",        required = false) String codeChallenge,
            @RequestParam(value = "code_challenge_method", required = false) String codeChallengeMethod) {

        if (responseType != null && !responseType.equals("code")) {
            return oauthErrorPage("unsupported_response_type", "Only response_type=code is supported.");
        }
        if (clientId == null || redirectUri == null || scope == null || state == null) {
            return oauthErrorPage("invalid_request",
                    "Missing required parameter (client_id, redirect_uri, scope, state).");
        }

        OAuthAuthorizeRequest req = new OAuthAuthorizeRequest();
        req.setClientId(clientId);
        req.setRedirectUri(redirectUri);
        // scopes arrive space- (or +/comma-) separated; normalize to the space form
        req.setScope(scope.replaceAll("[+,\\s]+", " ").trim());
        req.setState(state);
        req.setCodeChallenge(codeChallenge);
        req.setCodeChallengeMethod(codeChallengeMethod);

        try {
            String pendingState = oAuthService.initiateAuthorize(req);
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(CONSENT_BASE + pendingState))
                    .build();
        } catch (AppException e) {
            return oauthErrorPage(e.getCode(), e.getMessage());
        }
    }

    private ResponseEntity<String> oauthErrorPage(String error, String description) {
        String body = "OAuth error: " + error + " — " + description;
        return ResponseEntity.badRequest()
                .contentType(org.springframework.http.MediaType.TEXT_PLAIN)
                .body(body);
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
