package com.aza.backend.service;

import com.aza.backend.dto.auth.AuthResponse;
import com.aza.backend.dto.auth.BiometricLoginRequest;
import com.aza.backend.dto.auth.BiometricTokenRequest;
import com.aza.backend.dto.auth.BiometricTokenResponse;
import com.aza.backend.entity.BiometricToken;
import com.aza.backend.entity.User;
import com.aza.backend.repository.BiometricTokenRepository;
import com.aza.backend.repository.RefreshTokenRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.security.JwtUtil;
import com.aza.backend.util.EmailService;
import com.aza.backend.util.RateLimitService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class BiometricService {

    private final BiometricTokenRepository biometricTokenRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final UserRepository userRepository;
    private final UserService userService;
    private final JwtUtil jwtUtil;
    private final RateLimitService rateLimitService;
    private final EmailService emailService;

    private static final int TOKEN_EXPIRY_DAYS = 90;
    private static final int MAX_ENROLLED_DEVICES = 5;

    // ==================== ISSUE BIOMETRIC TOKEN ====================

    /**
     * Issues a long-lived biometric token for the device.
     * Requires the user to verify their passcode first — this is the
     * "enrollment" step where the user confirms they want to enable biometrics
     * Called from: Settings → Enable Face ID / Fingerprint
     */
    @Transactional
    public BiometricTokenResponse issueBiometricToken(User user, BiometricTokenRequest request) {
        // 1. Verify account is active
        if (user.getStatus() != User.AccountStatus.ACTIVE) {
            throw new RuntimeException("Account is not active");
        }

        // 2. Verify passcode — proves user has physical access + knows their PIN
        userService.verifyPasscode(user, request.getPasscode());

        // 3. Enforce device cap — count existing tokens not on this device
        long enrolledCount = biometricTokenRepository.findAllByUserId(user.getId()).stream()
                .filter(t -> !t.getDeviceId().equals(request.getDeviceId()))
                .count();
        if (enrolledCount >= MAX_ENROLLED_DEVICES) {
            throw new RuntimeException(
                    "Maximum of " + MAX_ENROLLED_DEVICES + " enrolled devices reached. Remove an existing device first.");
        }

        // 4. If a biometric token already exists for this device, revoke it and alert the user
        biometricTokenRepository.findByUserIdAndDeviceId(user.getId(), request.getDeviceId())
                .ifPresent(existing -> {
                    biometricTokenRepository.delete(existing);
                    log.info("Revoked existing biometric token for device: {}", request.getDeviceId());
                    emailService.sendEmail(
                            user.getEmail(),
                            "Biometric login re-enrolled on your device",
                            "Hi " + user.getFirstName() + ", biometric authentication was re-enrolled on device \""
                                    + request.getDeviceName() + "\". If this wasn't you, secure your account immediately."
                    );
                });

        // 5. Generate a cryptographically secure random token (32 bytes = 256 bits)
        byte[] rawTokenBytes = new byte[32];
        new SecureRandom().nextBytes(rawTokenBytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(rawTokenBytes);

        // 6. Store only the hash — never store the raw token
        String tokenHash = hashToken(rawToken);
        LocalDateTime expiresAt = LocalDateTime.now().plusDays(TOKEN_EXPIRY_DAYS);

        BiometricToken biometricToken = BiometricToken.builder()
                .userId(user.getId())
                .tokenHash(tokenHash)
                .deviceId(request.getDeviceId())
                .deviceName(request.getDeviceName())
                .deviceOs(request.getDeviceOs())
                .expiresAt(expiresAt)
                .build();

        biometricTokenRepository.save(biometricToken);

        // 7. Update user entity to reflect biometrics are enabled
        user.setBiometricsEnabled(true);
        userRepository.save(user);

        log.info("Biometric token issued for user {} on device {}", user.getId(), request.getDeviceId());

        // 8. Return the raw token — device must store this in SecureStore immediately
        return BiometricTokenResponse.builder()
                .biometricToken(rawToken)
                .deviceId(request.getDeviceId())
                .expiresAt(expiresAt.toString())
                .message("Biometrics enabled. Store this token securely on your device.")
                .build();
    }

    // ==================== BIOMETRIC LOGIN ====================

    /**
     * Exchanges a biometric token for fresh JWT tokens.
     * Called when the user opens the app and passes Face ID / fingerprint
     * The device only calls this AFTER the OS has verified the biometric.
     * The server trusts that the device enforced the biometric check.
     */
    @Transactional
    public AuthResponse biometricLogin(BiometricLoginRequest request, String ipAddress) {
        // 1. Rate limit — prevent brute-force token guessing
        rateLimitService.enforceRateLimit("biometric_login:" + ipAddress, 10, Duration.ofMinutes(15));

        // 2. Hash the incoming token and look it up
        String tokenHash = hashToken(request.getBiometricToken());
        BiometricToken stored = biometricTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new RuntimeException("Invalid biometric token"));

        // 3. Verify the device ID matches — prevents token from being used on another device
        if (!stored.getDeviceId().equals(request.getDeviceId())) {
            throw new RuntimeException("Biometric token is not valid for this device");
        }

        // 4. Check token is active and not expired
        if (!Boolean.TRUE.equals(stored.getActive())) {
            throw new RuntimeException("Biometric token has been revoked");
        }
        if (stored.isExpired()) {
            biometricTokenRepository.delete(stored);
            throw new RuntimeException("Biometric token has expired. Please re-enable biometrics in settings.");
        }

        // 5. Load user and verify account is active
        User user = userRepository.findById(stored.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.getStatus() != User.AccountStatus.ACTIVE) {
            throw new RuntimeException("Account is not active");
        }

        // 6. Update last used timestamp
        stored.setLastUsedAt(LocalDateTime.now());
        biometricTokenRepository.save(stored);

        // 7. Update user last login
        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);

        // 8. Issue fresh JWT tokens
        String accessToken = jwtUtil.generateAccessToken(user.getId(), user.getEmail());
        String refreshToken = jwtUtil.generateRefreshToken(user.getId(), user.getEmail());

        // Store hashed refresh token
        saveRefreshToken(user.getId(), refreshToken, accessToken, stored.getDeviceName(), stored.getDeviceOs(), stored.getDeviceId(), ipAddress);

        // Notify user of biometric login — same signal as password login
        emailService.sendLoginNotification(
                user.getEmail(), user.getFirstName(), stored.getDeviceName(), stored.getDeviceOs(), ipAddress);

        log.info("Biometric login successful for user {} on device {}", user.getId(), request.getDeviceId());

        return buildAuthResponse(user, accessToken, refreshToken);
    }

    // ==================== REVOKE ====================

    /**
     * Revoke biometric token for a specific device.
     * Called when user disables biometrics or removes a device.
     */
    @Transactional
    public void revokeBiometricToken(User user, String deviceId) {
        BiometricToken token = biometricTokenRepository
                .findByUserIdAndDeviceId(user.getId(), deviceId)
                .orElseThrow(() -> new RuntimeException("No biometric token found for this device"));

        biometricTokenRepository.delete(token);

        // Check if user has any other active biometric tokens
        boolean hasOtherTokens = !biometricTokenRepository.findAllByUserId(user.getId()).isEmpty();
        if (!hasOtherTokens) {
            user.setBiometricsEnabled(false);
            userRepository.save(user);
        }

        log.info("Biometric token revoked for user {} on device {}", user.getId(), deviceId);
    }

    /**
     * Revoke ALL biometric tokens for a user.
     * Called on logout-everywhere or account deactivation.
     */
    @Transactional
    public void revokeAllBiometricTokens(User user) {
        biometricTokenRepository.deleteAllByUserId(user.getId());
        user.setBiometricsEnabled(false);
        userRepository.save(user);
        log.info("All biometric tokens revoked for user {}", user.getId());
    }

    // ==================== HELPERS ====================

    private String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    private void saveRefreshToken(UUID userId, String rawRefreshToken, String rawAccessToken,
                                  String deviceName, String deviceOs, String deviceId, String ipAddress) {
        Duration accessValidity = jwtUtil.getRemainingValidity(rawAccessToken);
        LocalDateTime accessExpiresAt = accessValidity.isZero()
                ? LocalDateTime.now()
                : LocalDateTime.now().plus(accessValidity);

        // Check if a session already exists for this user and device
        com.aza.backend.entity.RefreshToken rt = refreshTokenRepository.findByUserIdAndDeviceId(userId, deviceId)
                .orElse(new com.aza.backend.entity.RefreshToken());

        rt.setUserId(userId);
        rt.setTokenHash(hashToken(rawRefreshToken));
        rt.setAccessTokenHash(hashToken(rawAccessToken));
        rt.setAccessTokenExpiresAt(accessExpiresAt);
        rt.setDeviceName(deviceName);
        rt.setDeviceOs(deviceOs);
        rt.setDeviceId(deviceId);
        rt.setIpAddress(ipAddress);
        rt.setExpiresAt(LocalDateTime.now().plusDays(30));

        refreshTokenRepository.save(rt);
    }

    private AuthResponse buildAuthResponse(User user, String accessToken, String refreshToken) {
        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .user(AuthResponse.UserInfo.builder()
                        .id(user.getId().toString())
                        .email(user.getEmail())
                        .firstName(user.getFirstName())
                        .lastName(user.getLastName())
                        .displayName(user.getDisplayName())
                        .profileImageUrl(user.getProfileImageUrl())
                        .kycStatus(user.getKycStatus().name())
                        .passcodeSet(user.getPasscodeHash() != null)
                        .build())
                .build();
    }
}
