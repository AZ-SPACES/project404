package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.auth.*;
import com.aza.backend.entity.User;
import com.aza.backend.service.AuthService;
import com.aza.backend.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final UserService userService;

    @PostMapping("/signup")
    public ResponseEntity<ApiResponse<AuthResponse>> signup(
            @Valid @RequestBody SignupRequest request, HttpServletRequest httpRequest) {
        String ipAddress = getClientIp(httpRequest);
        AuthResponse response = authService.signup(request, ipAddress);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<String>> login(
            @Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        String ipAddress = getClientIp(httpRequest);
        authService.preLogin(request, ipAddress);
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

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthResponse>> refreshToken(
            @Valid @RequestBody RefreshTokenRequest request) {
        AuthResponse response = authService.refreshToken(request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * Verifies an OTP code. For login purpose, returns either:
     * - AuthResponse (full JWT) if 2FA is not enabled
     * - TotpPendingResponse (preAuthToken) if 2FA is enabled — client must follow up via POST /auth/2fa/login
     */
    @PostMapping("/verify-otp")
    public ResponseEntity<ApiResponse<Object>> verifyOtp(
            @Valid @RequestBody OtpVerifyRequest request, HttpServletRequest httpRequest) {
        if ("login".equalsIgnoreCase(request.getPurpose())) {
            String ipAddress = getClientIp(httpRequest);
            Object response = authService.loginWithOtp(request, ipAddress);
            return ResponseEntity.ok(ApiResponse.success(response));
        }

        authService.verifyOtp(request.getIdentifier(), request.getCode(), request.getPurpose());
        return ResponseEntity.ok(ApiResponse.success("OTP verified successfully"));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<String>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request) {
        authService.forgotPassword(request);
        return ResponseEntity.ok(ApiResponse.success("OTP sent to your email/phone"));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<String>> resetPassword(
            @Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ResponseEntity.ok(ApiResponse.success("Password reset successfully"));
    }

    @PostMapping("/change-password")
    public ResponseEntity<ApiResponse<String>> changePassword(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(user, request);
        return ResponseEntity.ok(ApiResponse.success("Password changed successfully"));
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

    /**
     * Regenerates all recovery codes for the account.
     * Old codes are invalidated immediately. Requires a valid TOTP code.
     */
    @PostMapping("/2fa/recovery/regenerate")
    public ResponseEntity<ApiResponse<RecoveryCodesResponse>> regenerateRecoveryCodes(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody TotpToggleRequest request) {
        RecoveryCodesResponse codes = authService.regenerateRecoveryCodes(user, request.getCode());
        return ResponseEntity.ok(ApiResponse.success(codes));
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

    private static final java.util.regex.Pattern IP_PATTERN =
            java.util.regex.Pattern.compile(
                    "^(([0-9]{1,3}\\.){3}[0-9]{1,3}|[0-9a-fA-F:]{2,39})$");

    private String getClientIp(HttpServletRequest request) {
        String xfHeader = request.getHeader("X-Forwarded-For");
        if (xfHeader != null && !xfHeader.isBlank()) {
            // Take the leftmost IP — the original client address
            String candidate = xfHeader.split(",")[0].trim();
            if (IP_PATTERN.matcher(candidate).matches()) {
                return candidate;
            }
        }
        return request.getRemoteAddr();
    }
}
