package com.aza.backend.service;

import com.aza.backend.dto.auth.*;
import com.aza.backend.entity.RefreshToken;
import com.aza.backend.entity.User;
import com.aza.backend.entity.Wallet;
import com.aza.backend.repository.RefreshTokenRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.WalletRepository;
import com.aza.backend.security.JwtUtil;
import com.aza.backend.util.EmailService;
import com.aza.backend.util.RateLimitService;
import com.aza.backend.util.SmsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final StringRedisTemplate redisTemplate;
    private final SmsService smsService;
    private final EmailService emailService;
    private final RateLimitService rateLimitService;
    private final UserService userService;

    private final BiometricService biometricService;

    private static final String BLACKLIST_PREFIX = "jwt:blacklist:";
    private static final String OTP_PREFIX = "otp:";

    // ==================== SIGNUP ====================

    @Transactional
    public AuthResponse signup(SignupRequest request, String ipAddress) {
        rateLimitService.enforceRateLimit("signup:" + ipAddress, 3, Duration.ofHours(1));

        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("An account with this email or phone already exists");
        }
        if (userRepository.existsByPhone(request.getPhone())) {
            throw new RuntimeException("An account with this email or phone already exists");
        }

        User user = User.builder()
                .phone(request.getPhone())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .displayName(request.getDisplayName())
                .handle(request.getHandle())
                .homeAddress(request.getHomeAddress())
                .city(request.getCity())
                .nationality(request.getNationality())
                .build();

        userService.applyDateOfBirthAndEmployment(
                user, request.getDateOfBirth(), request.getEmploymentStatus());

        user = userRepository.save(user);

        Wallet wallet = Wallet.builder()
                .userId(user.getId())
                .currency("GHS")
                .build();
        walletRepository.save(wallet);

        return finalizeLogin(user, request.getDeviceName(), request.getDeviceOs(), ipAddress);
    }

    // ==================== LOGIN ====================

    public void preLogin(LoginRequest request, String ipAddress) {
        rateLimitService.enforceRateLimit("login:" + ipAddress, 5, Duration.ofMinutes(15));

        User user = userRepository
                .findByEmailOrPhone(request.getIdentifier(), request.getIdentifier())
                .orElseThrow(() -> new RuntimeException("Invalid credentials"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new RuntimeException("Invalid credentials");
        }

        if (user.getStatus() != User.AccountStatus.ACTIVE) {
            throw new RuntimeException("Invalid credentials");
        }

        sendOtp(request.getIdentifier(), "login");
    }

    @Transactional
    public AuthResponse loginWithOtp(OtpVerifyRequest request, String ipAddress) {
        verifyOtp(request.getIdentifier(), request.getCode(), "login");

        User user = userRepository
                .findByEmailOrPhone(request.getIdentifier(), request.getIdentifier())
                .orElseThrow(() -> new RuntimeException("User not found"));

        return finalizeLogin(user, request.getDeviceName(), request.getDeviceOs(), ipAddress);
    }

    private AuthResponse finalizeLogin(User user, String deviceName,
                                       String deviceOs, String ipAddress) {
        if (user.getStatus() != User.AccountStatus.ACTIVE) {
            throw new RuntimeException("Account is not active");
        }

        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);

        String accessToken = jwtUtil.generateAccessToken(user.getId(), user.getEmail());
        String refreshToken = jwtUtil.generateRefreshToken(user.getId(), user.getEmail());

        saveRefreshToken(user.getId(), refreshToken, deviceName, deviceOs, ipAddress);

        emailService.sendLoginNotification(
                user.getEmail(), user.getFirstName(), deviceName, deviceOs, ipAddress);

        return buildAuthResponse(user, accessToken, refreshToken);
    }

    // ==================== LOGOUT ====================

    public void logout(String accessToken) {
        Duration remaining = jwtUtil.getRemainingValidity(accessToken);
        if (!remaining.isZero()) {
            redisTemplate.opsForValue().set(
                    BLACKLIST_PREFIX + hashToken(accessToken),
                    "blacklisted",
                    remaining
            );
        }
    }

    @Transactional
    public void logoutEverywhere(User user) {
        refreshTokenRepository.deleteAllByUserId(user.getId());
        biometricService.revokeAllBiometricTokens(user);
    }
    // ==================== REFRESH TOKEN ====================

    @Transactional
    public AuthResponse refreshToken(RefreshTokenRequest request) {
        String token = request.getRefreshToken();

        if (jwtUtil.isInvalid(token)) {
            throw new RuntimeException("Invalid or expired refresh token");
        }

        if (!"REFRESH".equals(jwtUtil.getTokenType(token))) {
            throw new RuntimeException("Invalid token type");
        }

        String tokenHash = hashToken(token);
        RefreshToken stored = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new RuntimeException(
                        "Refresh token not found — may have been revoked"));

        if (stored.isExpired()) {
            refreshTokenRepository.delete(stored);
            throw new RuntimeException("Refresh token expired");
        }

        refreshTokenRepository.delete(stored);

        UUID userId = jwtUtil.getUserIdFromToken(token);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        String newAccessToken = jwtUtil.generateAccessToken(user.getId(), user.getEmail());
        String newRefreshToken = jwtUtil.generateRefreshToken(user.getId(), user.getEmail());

        saveRefreshToken(user.getId(), newRefreshToken,
                stored.getDeviceName(), stored.getDeviceOs(), stored.getIpAddress());

        return buildAuthResponse(user, newAccessToken, newRefreshToken);
    }

    // ==================== OTP ====================

    public void sendOtp(String identifier, String purpose) {
        rateLimitService.enforceRateLimit("otp:" + identifier, 3, Duration.ofMinutes(10));

        String otp = String.format("%06d",
                new java.security.SecureRandom().nextInt(1_000_000));
        String key = OTP_PREFIX + purpose + ":" + identifier;
        redisTemplate.opsForValue().set(key, otp, Duration.ofMinutes(5));


        if (identifier.contains("@")) {
            boolean sent = emailService.sendOtp(identifier, otp);
            if (!sent) log.warn("Email OTP delivery failed for {}", identifier);
        } else {
            boolean sent = smsService.sendOtp(identifier, otp);
            if (!sent) log.warn("SMS OTP delivery failed for {}", identifier);
        }
    }

    public void verifyOtp(String identifier, String code, String purpose) {
        String attemptKey = "otp:attempts:" + purpose + ":" + identifier;
        String attemptsStr = redisTemplate.opsForValue().get(attemptKey);
        int attempts = attemptsStr != null ? Integer.parseInt(attemptsStr) : 0;

        if (attempts >= 5) {
            redisTemplate.delete(OTP_PREFIX + purpose + ":" + identifier);
            redisTemplate.delete(attemptKey);
            throw new RuntimeException("Too many failed OTP attempts. Request a new code.");
        }

        String key = OTP_PREFIX + purpose + ":" + identifier;
        String storedOtp = redisTemplate.opsForValue().get(key);

        if (storedOtp == null) {
            throw new RuntimeException("OTP expired or not found");
        }
        if (!storedOtp.equals(code)) {
            redisTemplate.opsForValue().set(attemptKey,
                    String.valueOf(attempts + 1), Duration.ofMinutes(5));
            throw new RuntimeException("Invalid OTP code.");
        }

        redisTemplate.delete(key);
        redisTemplate.delete(attemptKey);
    }

    // ==================== FORGOT / RESET PASSWORD ====================

    public void forgotPassword(ForgotPasswordRequest request) {
        rateLimitService.enforceRateLimit(
                "forgot_pwd:" + request.getIdentifier(), 3, Duration.ofMinutes(10));

        userRepository.findByEmailOrPhone(
                        request.getIdentifier(), request.getIdentifier())
                .ifPresent(user -> sendOtp(request.getIdentifier(), "password_reset"));
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        verifyOtp(request.getIdentifier(), request.getCode(), "password_reset");

        User user = userRepository
                .findByEmailOrPhone(request.getIdentifier(), request.getIdentifier())
                .orElseThrow(() -> new RuntimeException("User not found"));

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        // Invalidate all sessions — password reset implies potential account compromise
        refreshTokenRepository.deleteAllByUserId(user.getId());
        biometricService.revokeAllBiometricTokens(user);
    }

    // ==================== CHANGE PASSWORD ====================

    @Transactional
    public void changePassword(User user, ChangePasswordRequest request) {
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new RuntimeException("Current password is incorrect");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        // Revoke all other sessions so stolen tokens can't outlive the password change
        refreshTokenRepository.deleteAllByUserId(user.getId());
        biometricService.revokeAllBiometricTokens(user);
    }

    // ==================== HELPERS ====================


    public void saveRefreshToken(UUID userId, String rawToken,
                                 String deviceName, String deviceOs, String ipAddress) {
        RefreshToken rt = RefreshToken.builder()
                .userId(userId)
                .tokenHash(hashToken(rawToken))
                .deviceName(deviceName)
                .deviceOs(deviceOs)
                .ipAddress(ipAddress)
                .expiresAt(LocalDateTime.now().plusDays(30))
                .build();
        refreshTokenRepository.save(rt);
    }

    public String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    private AuthResponse buildAuthResponse(User user, String accessToken, String refreshToken) {
        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .user(userService.getProfile(user))
                .build();
    }
}