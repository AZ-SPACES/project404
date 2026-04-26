package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.auth.*;
import com.aza.backend.entity.User;
import com.aza.backend.service.AuthService;
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
        authService.logoutEverywhere(user.getId());
        return ResponseEntity.ok(ApiResponse.success("All sessions revoked"));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthResponse>> refreshToken(
            @Valid @RequestBody RefreshTokenRequest request) {
        AuthResponse response = authService.refreshToken(request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<ApiResponse<Object>> verifyOtp(
            @Valid @RequestBody OtpVerifyRequest request, HttpServletRequest httpRequest) {
        if ("login".equalsIgnoreCase(request.getPurpose())) {
            String ipAddress = getClientIp(httpRequest);
            AuthResponse response = authService.loginWithOtp(request, ipAddress);
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
        authService.setPasscode(user, request);
        return ResponseEntity.ok(ApiResponse.success("Passcode set successfully"));
    }

    @PostMapping("/passcode/verify")
    public ResponseEntity<ApiResponse<String>> verifyPasscode(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody PasscodeRequest request) {
        authService.verifyPasscode(user, request.getPasscode());
        return ResponseEntity.ok(ApiResponse.success("Passcode verified"));
    }

    private String getClientIp(HttpServletRequest request) {
        String xfHeader = request.getHeader("X-Forwarded-For");
        if (xfHeader == null || xfHeader.isEmpty()) {
            return request.getRemoteAddr();
        }
        return xfHeader.split(",")[0].trim();
    }
}
