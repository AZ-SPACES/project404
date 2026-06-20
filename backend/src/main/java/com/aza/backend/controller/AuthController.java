package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.auth.*;
import com.aza.backend.entity.User;
import com.aza.backend.service.AuthService;
import com.aza.backend.service.UserService;
import com.aza.backend.service.OtpService;
import com.aza.backend.security.fingerprint.RequestFingerprintService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Set;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final UserService userService;
    private final OtpService otpService;
    private final RequestFingerprintService requestFingerprintService;

    @PostMapping("/signup")
    public ResponseEntity<ApiResponse<AuthResponse>> signup(
            @Valid @RequestBody SignupRequest request, HttpServletRequest httpRequest) {
        String ipAddress = getClientIp(httpRequest);
        AuthResponse response = authService.signup(request, ipAddress);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<Object>> login(
            @Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        String ipAddress = getClientIp(httpRequest);
        boolean merchantPortal = "merchant-portal".equalsIgnoreCase(httpRequest.getHeader("X-Aza-Client"));
        Object response = authService.preLogin(request, ipAddress, merchantPortal);
        if (response != null) {
            return ResponseEntity.ok(ApiResponse.success(response));
        }
        return ResponseEntity.ok(ApiResponse.success("OTP sent to your email/phone. Please verify to complete login."));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<String>> logout(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            authService.logout(authHeader.substring(7));
        }
        return ResponseEntity.ok(ApiResponse.success("Logged out successfully"));
    }

    @PostMapping("/logout-everywhere")
    public ResponseEntity<ApiResponse<String>> logoutEverywhere(
            @AuthenticationPrincipal User user) {
        authService.logoutEverywhere(user);
        return ResponseEntity.ok(ApiResponse.success("All sessions revoked"));
    }

    @PostMapping("/secure-account")
    public ResponseEntity<ApiResponse<String>> secureAccount(
            @AuthenticationPrincipal User user,
            HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        authService.secureAccount(user, authHeader != null && authHeader.startsWith("Bearer ")
                ? authHeader.substring(7) : null);
        return ResponseEntity.ok(ApiResponse.success("Account secured. All sessions revoked."));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthResponse>> refreshToken(
            @Valid @RequestBody RefreshTokenRequest request) {
        AuthResponse response = authService.refreshToken(request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    private static final Set<String> VALID_OTP_PURPOSES = Set.of("login", "signup", "password_reset");

    /**
     * Verifies an OTP code. For login purpose, returns either:
     * - AuthResponse (full JWT) if 2FA is not enabled
     * - TotpPendingResponse (preAuthToken) if 2FA is enabled — client must follow up via POST /auth/2fa/login
     */
    @PostMapping("/verify-otp")
    public ResponseEntity<ApiResponse<Object>> verifyOtp(
            @Valid @RequestBody OtpVerifyRequest request, HttpServletRequest httpRequest) {
        String purpose = request.getPurpose() != null ? request.getPurpose().toLowerCase() : "";
        if (!VALID_OTP_PURPOSES.contains(purpose)) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("BAD_REQUEST", "Invalid OTP purpose"));
        }

        if ("login".equals(purpose)) {
            String ipAddress = getClientIp(httpRequest);
            Object response = authService.loginWithOtp(request, ipAddress);
            return ResponseEntity.ok(ApiResponse.success(response));
        }

        otpService.verifyOtp(request.getIdentifier(), request.getCode(), purpose);
        return ResponseEntity.ok(ApiResponse.success("OTP verified successfully"));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<String>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request) {
        authService.forgotPassword(request);
        return ResponseEntity.ok(ApiResponse.success("OTP sent to your email/phone"));
    }

    @PostMapping("/account-recovery/init")
    public ResponseEntity<ApiResponse<String>> initAccountRecovery(
            @RequestParam String email, HttpServletRequest httpRequest) {
        String ip = getClientIp(httpRequest);
        String preAuthToken = authService.initAccountRecovery(email, ip);
        return ResponseEntity.ok(ApiResponse.success(preAuthToken));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<String>> resetPassword(
            @Valid @RequestBody ResetPasswordRequest request, HttpServletRequest httpRequest) {
        String ipAddress = getClientIp(httpRequest);
        authService.resetPassword(request, ipAddress);
        return ResponseEntity.ok(ApiResponse.success("Password reset successfully"));
    }

    @PostMapping("/change-password")
    public ResponseEntity<ApiResponse<String>> changePassword(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody ChangePasswordRequest request, HttpServletRequest httpRequest) {
        String ipAddress = getClientIp(httpRequest);
        authService.changePassword(user, request, ipAddress);
        return ResponseEntity.ok(ApiResponse.success("Password changed successfully"));
    }

    @PostMapping("/secure-account-with-token")
    public ResponseEntity<ApiResponse<String>> secureWithToken(
            @RequestParam String token) {
        authService.secureAccountWithToken(token);
        return ResponseEntity.ok(ApiResponse.success("Account secured successfully"));
    }

    @PostMapping("/passcode/set")
    public ResponseEntity<ApiResponse<String>> setPasscode(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody PasscodeRequest request) {
        userService.setPasscode(user, request.getPasscode());
        return ResponseEntity.ok(ApiResponse.success("Passcode set successfully"));
    }

    @PostMapping("/passcode/verify")
    public ResponseEntity<ApiResponse<String>> verifyPasscode(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody PasscodeRequest request) {
        userService.verifyPasscode(user, request.getPasscode());
        return ResponseEntity.ok(ApiResponse.success("Passcode verified"));
    }

    // ==================== 2FA / TOTP ====================

    /**
     * Step 1 of 2FA setup: generates a TOTP secret and returns it with a QR code URI.
     * The client encodes the qrUri as a QR code for the user to scan.
     * The secret is NOT yet committed — user must call /2fa/confirm to activate.
     */
    @PostMapping("/2fa/setup")
    public ResponseEntity<ApiResponse<TotpSetupResponse>> setupTotp(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(authService.initiateTotpSetup(user)));
    }

    /**
     * Step 2 of 2FA setup: verifies the first TOTP code from the authenticator app.
     * On success, 2FA is enabled and 8 one-time recovery codes are returned.
     * These codes are shown ONLY ONCE — the client must prompt the user to save them.
     */
    @PostMapping("/2fa/confirm")
    public ResponseEntity<ApiResponse<RecoveryCodesResponse>> confirmTotp(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody TotpToggleRequest request) {
        RecoveryCodesResponse codes = authService.confirmTotpSetup(user, request.getCode());
        return ResponseEntity.ok(ApiResponse.success(codes));
    }

    /**
     * Completes login for accounts with 2FA enabled.
     * Accepts the preAuthToken returned by /verify-otp and a 6-digit TOTP code.
     * Returns full auth tokens on success.
     */
    @PostMapping("/2fa/login")
    public ResponseEntity<ApiResponse<AuthResponse>> verifyTotpLogin(
            @Valid @RequestBody TotpLoginRequest request,
            HttpServletRequest httpRequest) {
        String ipAddress = getClientIp(httpRequest);
        AuthResponse response = authService.verifyTotpLogin(request, ipAddress);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * Alternative 2FA login using a one-time recovery code instead of the authenticator app.
     * The recovery code is consumed immediately and cannot be reused.
     */
    @PostMapping("/2fa/recovery")
    public ResponseEntity<ApiResponse<AuthResponse>> redeemRecoveryCode(
            @Valid @RequestBody RedeemRecoveryCodeRequest request,
            HttpServletRequest httpRequest) {
        String ipAddress = getClientIp(httpRequest);
        AuthResponse response = authService.redeemRecoveryCode(request, ipAddress);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/2fa/recovery/count")
    public ResponseEntity<ApiResponse<Long>> getRecoveryCodeCount(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(authService.getRecoveryCodeCount(user)));
    }

    @PostMapping("/2fa/recovery/sms/request")
    public ResponseEntity<ApiResponse<String>> requestRecoveryRegenSms(
            @AuthenticationPrincipal User user) {
        authService.requestRecoveryCodeRegenSms(user);
        return ResponseEntity.ok(ApiResponse.success("OTP sent to your phone"));
    }

    /**
     * Regenerates all recovery codes. Accepts TOTP or SMS verification depending on what the user has enabled.
     */
    @PostMapping("/2fa/recovery/regenerate")
    public ResponseEntity<ApiResponse<RecoveryCodesResponse>> regenerateRecoveryCodes(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "TOTP") String method,
            @Valid @RequestBody TotpToggleRequest request) {
        RecoveryCodesResponse codes = authService.regenerateRecoveryCodes(user, request.getCode(), method);
        return ResponseEntity.ok(ApiResponse.success(codes));
    }

    @PutMapping("/2fa/default-method")
    public ResponseEntity<ApiResponse<String>> setDefault2faMethod(
            @AuthenticationPrincipal User user,
            @RequestParam String method) {
        authService.setDefaultTwoFactorMethod(user, method);
        return ResponseEntity.ok(ApiResponse.success("Default method updated"));
    }

    @PostMapping("/2fa/sms/setup")
    public ResponseEntity<ApiResponse<String>> setupSms2fa(
            @AuthenticationPrincipal User user) {
        authService.initiateSms2faSetup(user);
        return ResponseEntity.ok(ApiResponse.success("OTP sent to your phone"));
    }

    @PostMapping("/2fa/sms/confirm")
    public ResponseEntity<ApiResponse<RecoveryCodesResponse>> confirmSms2fa(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody TotpToggleRequest request) {
        RecoveryCodesResponse codes = authService.confirmSms2faSetup(user, request.getCode());
        return ResponseEntity.ok(ApiResponse.success(codes));
    }

    @PostMapping("/2fa/email/setup")
    public ResponseEntity<ApiResponse<String>> setupEmail2fa(
            @AuthenticationPrincipal User user) {
        authService.initiateEmail2faSetup(user);
        return ResponseEntity.ok(ApiResponse.success("OTP sent to your email"));
    }

    @PostMapping("/2fa/email/confirm")
    public ResponseEntity<ApiResponse<RecoveryCodesResponse>> confirmEmail2fa(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody TotpToggleRequest request) {
        RecoveryCodesResponse codes = authService.confirmEmail2faSetup(user, request.getCode());
        return ResponseEntity.ok(ApiResponse.success(codes));
    }

    @PostMapping("/2fa/app/toggle")
    public ResponseEntity<ApiResponse<String>> toggleApp2fa(
            @AuthenticationPrincipal User user,
            @RequestParam boolean enabled) {
        authService.toggleApp2fa(user, enabled);
        return ResponseEntity.ok(ApiResponse.success("App 2FA updated"));
    }

    @PostMapping("/2fa/app/request")
    public ResponseEntity<ApiResponse<String>> requestAppApproval(@RequestParam String preAuthToken) {
        String requestId = authService.requestAppApproval(preAuthToken);
        return ResponseEntity.ok(ApiResponse.success(requestId));
    }

    @PostMapping("/2fa/app/respond")
    public ResponseEntity<ApiResponse<Void>> respondToAppApproval(
            @AuthenticationPrincipal User user,
            @RequestParam String requestId,
            @RequestParam boolean approve) {
        authService.respondToAppApproval(user.getId(), requestId, approve);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/2fa/app/status")
    public ResponseEntity<ApiResponse<AuthResponse>> checkAppApprovalStatus(@RequestParam String preAuthToken, @RequestParam String requestId) {
        AuthResponse authResponse = authService.checkAppApprovalStatus(preAuthToken, requestId);
        return ResponseEntity.ok(ApiResponse.success(authResponse));
    }

    @PostMapping("/2fa/sms/request")
    public ResponseEntity<ApiResponse<Void>> requestSms2fa(@RequestParam String preAuthToken) {
        authService.requestSms2fa(preAuthToken);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/2fa/email/request")
    public ResponseEntity<ApiResponse<Void>> requestEmail2fa(@RequestParam String preAuthToken) {
        authService.requestEmail2fa(preAuthToken);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/2fa/otp/verify")
    public ResponseEntity<ApiResponse<AuthResponse>> verify2faOtp(
            @RequestParam String preAuthToken,
            @RequestParam String code,
            @RequestParam String method,
            HttpServletRequest httpRequest) {
        AuthResponse response = authService.verify2faOtp(preAuthToken, code, method, getClientIp(httpRequest));
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/2fa/sms/disable/request")
    public ResponseEntity<ApiResponse<String>> requestDisableSms2fa(
            @AuthenticationPrincipal User user) {
        authService.requestDisableSms2fa(user);
        return ResponseEntity.ok(ApiResponse.success("OTP sent to your phone"));
    }

    @DeleteMapping("/2fa/sms")
    public ResponseEntity<ApiResponse<String>> disableSms2fa(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody TotpToggleRequest request) {
        authService.disableSms2fa(user, request.getCode());
        return ResponseEntity.ok(ApiResponse.success("SMS two-factor authentication disabled"));
    }

    @PostMapping("/2fa/passkeys/verify")
    public ResponseEntity<ApiResponse<AuthResponse>> verifyPasskeys2fa(
            @RequestParam String preAuthToken,
            @Valid @RequestBody BiometricLoginRequest request,
            HttpServletRequest httpRequest) {
        String ipAddress = getClientIp(httpRequest);
        AuthResponse response = authService.verifyPasskeys2fa(preAuthToken, request.getBiometricToken(), request.getDeviceId(), ipAddress);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * Disables 2FA on the account. Requires a valid TOTP code to confirm intent.
     */
    @DeleteMapping("/2fa")
    public ResponseEntity<ApiResponse<String>> disableTotp(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody TotpToggleRequest request) {
        authService.disableTotp(user, request.getCode());
        return ResponseEntity.ok(ApiResponse.success("Two-factor authentication disabled"));
    }

    // Delegates to the central resolver, which trusts X-Forwarded-For / CF-Connecting-IP
    // only when the request arrives from a configured trusted proxy.
    private String getClientIp(HttpServletRequest request) {
        return requestFingerprintService.getClientIp(request);
    }
}
