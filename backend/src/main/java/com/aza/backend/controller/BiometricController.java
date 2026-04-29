package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.auth.AuthResponse;
import com.aza.backend.dto.auth.BiometricDeviceResponse;
import com.aza.backend.dto.auth.BiometricTokenRequest;
import com.aza.backend.dto.auth.BiometricLoginRequest;
import com.aza.backend.dto.auth.BiometricTokenResponse;
import com.aza.backend.entity.BiometricToken;
import com.aza.backend.entity.User;
import com.aza.backend.repository.BiometricTokenRepository;
import com.aza.backend.service.BiometricService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class BiometricController {

    private final BiometricService biometricService;
    private final BiometricTokenRepository biometricTokenRepository;

    @Value("${app.trusted-proxy-ips:}")
    private String trustedProxyIps;

    private static final Pattern IP_PATTERN =
            Pattern.compile("^(([0-9]{1,3}\\.){3}[0-9]{1,3}|[0-9a-fA-F:]{2,39})$");

    /**
     * POST /api/v1/auth/biometric-token
     * Enable biometrics — issues a long-lived token for the device.
     * Requires valid JWT + passcode verification.
     * Returns the raw token ONCE — device must store in SecureStore immediately.
     */
    @PostMapping("/biometric-token")
    public ResponseEntity<ApiResponse<BiometricTokenResponse>> enableBiometrics(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody BiometricTokenRequest request) {
        BiometricTokenResponse response = biometricService.issueBiometricToken(user, request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * POST /api/v1/auth/biometric-login
     * Exchange a biometric token for JWT tokens.
     * Called after device confirms Face ID / fingerprint locally.
     * PUBLIC — no JWT required, this IS the authentication step.
     */
    @PostMapping("/biometric-login")
    public ResponseEntity<ApiResponse<AuthResponse>> biometricLogin(
            @Valid @RequestBody BiometricLoginRequest request,
            HttpServletRequest httpRequest) {
        String ipAddress = getClientIp(httpRequest);
        AuthResponse response = biometricService.biometricLogin(request, ipAddress);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * POST /api/v1/auth/biometric-disable
     * Disable biometrics — revokes ALL biometric tokens for the user.
     */
    @PostMapping("/biometric-disable")
    public ResponseEntity<ApiResponse<String>> disableBiometrics(
            @AuthenticationPrincipal User user) {
        biometricService.revokeAllBiometricTokens(user);
        return ResponseEntity.ok(ApiResponse.success("Biometrics disabled on all devices"));
    }

    /**
     * GET /api/v1/auth/biometric-devices
     * List all devices with active biometric tokens.
     */
    @GetMapping("/biometric-devices")
    public ResponseEntity<ApiResponse<List<BiometricDeviceResponse>>> listDevices(
            @AuthenticationPrincipal User user) {
        List<BiometricDeviceResponse> devices = biometricTokenRepository
                .findAllByUserId(user.getId())
                .stream()
                .map(t -> BiometricDeviceResponse.builder()
                        .id(t.getId())
                        .deviceName(t.getDeviceName())
                        .deviceOs(t.getDeviceOs())
                        .lastUsedAt(t.getLastUsedAt())
                        .expiresAt(t.getExpiresAt())
                        .createdAt(t.getCreatedAt())
                        .build())
                .toList();
        return ResponseEntity.ok(ApiResponse.success(devices));
    }

    /**
     * DELETE /api/v1/auth/biometric-devices/{id}
     * Revoke biometric access for a specific device.
     */
    @DeleteMapping("/biometric-devices/{id}")
    public ResponseEntity<ApiResponse<String>> revokeDevice(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        BiometricToken token = biometricTokenRepository
                .findById(id)
                .orElseThrow(() -> new RuntimeException("Device not found"));

        // Ownership check — ensure the token belongs to this user
        if (!token.getUserId().equals(user.getId())) {
            throw new RuntimeException("Not authorized");
        }

        biometricTokenRepository.delete(token);

        // If no more biometric tokens, mark biometrics as disabled
        if (biometricTokenRepository.findAllByUserId(user.getId()).isEmpty()) {
            biometricService.revokeAllBiometricTokens(user);
        }

        return ResponseEntity.ok(ApiResponse.success("Biometric access revoked for device"));
    }

    private String getClientIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        if (trustedProxyIps != null && !trustedProxyIps.isBlank()) {
            Set<String> trusted = Set.of(trustedProxyIps.split(","));
            if (trusted.contains(remoteAddr)) {
                String forwarded = request.getHeader("X-Forwarded-For");
                if (forwarded != null && !forwarded.isBlank()) {
                    String candidate = forwarded.split(",")[0].trim();
                    if (IP_PATTERN.matcher(candidate).matches()) {
                        return candidate;
                    }
                }
            }
        }
        return remoteAddr;
    }
}