package com.aza.backend.service;

import com.aza.backend.dto.auth.*;
import com.aza.backend.entity.RecoveryCode;
import com.aza.backend.entity.RefreshToken;
import com.aza.backend.entity.User;
import com.aza.backend.entity.Wallet;
import com.aza.backend.entity.Transaction;
import com.aza.backend.repository.RecoveryCodeRepository;
import com.aza.backend.repository.RefreshTokenRepository;
import com.aza.backend.repository.TransactionRepository;
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
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final TransactionRepository transactionRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final StringRedisTemplate redisTemplate;
    private final SmsService smsService;
    private final EmailService emailService;
    private final RateLimitService rateLimitService;
    private final UserService userService;
    private final BiometricService biometricService;
    private final TotpService totpService;
    private final TotpEncryptionService totpEncryptionService;
    private final RecoveryCodeRepository recoveryCodeRepository;
    private final NotificationService notificationService;

    private static final int RECOVERY_CODE_COUNT = 8;
    private static final String BLACKLIST_PREFIX = "jwt:blacklist:";
    private static final String OTP_PREFIX = "otp:";
    private static final String TOTP_PREAUTH_PREFIX = "totp:preauth:";
    private static final String TOTP_SETUP_PREFIX = "totp:setup:";
    private static final String TOTP_USED_PREFIX = "totp:used:";

    // ==================== SIGNUP ====================

    @Transactional
    public AuthResponse signup(SignupRequest request, String ipAddress) {
        rateLimitService.enforceRateLimit("signup:" + ipAddress, 3, Duration.ofHours(1));

        String email = request.getEmail().toLowerCase().trim();
        if (userRepository.existsByEmail(email)) {
            throw new RuntimeException("An account with this email or phone already exists");
        }
        if (userRepository.existsByPhone(request.getPhone())) {
            throw new RuntimeException("An account with this email or phone already exists");
        }

        User user = User.builder()
                .phone(request.getPhone())
                .email(email)
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .passcodeHash(request.getPasscode() != null && !request.getPasscode().isEmpty() 
                    ? passwordEncoder.encode(request.getPasscode()) : null)
                .firstName(request.getFirstName())
                .lastName(request.getLastName())
                .displayName(request.getDisplayName())
                .handle(request.getHandle())
                .pronouns(request.getPronouns())
                .homeAddress(request.getHomeAddress())
                .city(request.getCity())
                .nationality(request.getNationality())
                .otherNationality(request.getOtherNationality())
                .isTaxResidentAbroad(request.getIsTaxResidentAbroad())
                .taxCountry(request.getTaxCountry())
                .isUSPerson(request.getIsUSPerson())
                .build();

        userService.applyDateOfBirthAndEmployment(
                user, request.getDateOfBirth(), request.getEmploymentStatus());

        user = userRepository.save(user);

        Wallet wallet = Wallet.builder()
                .userId(user.getId())
                .currency("GHS")
                .build();
        walletRepository.save(wallet);

        return finalizeLogin(user, request.getDeviceName(), request.getDeviceOs(), ipAddress, true);
    }

    // ==================== LOGIN ====================

    public void preLogin(LoginRequest request, String ipAddress) {
        rateLimitService.enforceRateLimit("login:" + ipAddress, 50, Duration.ofMinutes(15));

        String identifier = request.getIdentifier().trim();
        if (identifier.contains("@")) {
            identifier = identifier.toLowerCase();
        }

        User user = userRepository
                .findByEmailOrPhone(identifier, identifier)
                .orElseThrow(() -> new RuntimeException("Invalid credentials"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new RuntimeException("Invalid credentials");
        }

        if (user.getStatus() != User.AccountStatus.ACTIVE) {
            throw new RuntimeException("Invalid credentials");
        }

        sendOtp(identifier, "login");
    }

    @Transactional
    public Object loginWithOtp(OtpVerifyRequest request, String ipAddress) {
        rateLimitService.enforceRateLimit("otp_verify:" + ipAddress, 100, Duration.ofMinutes(15));
        verifyOtp(request.getIdentifier(), request.getCode(), "login");

        User user = userRepository
                .findByEmailOrPhone(request.getIdentifier(), request.getIdentifier())
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (Boolean.TRUE.equals(user.getTwoFactorEnabled())) {
            String preAuthToken = UUID.randomUUID().toString();
            // Pipe-delimited: userId|deviceName|deviceOs|ipAddress
            String value = user.getId()
                    + "|" + sanitize(request.getDeviceName())
                    + "|" + sanitize(request.getDeviceOs())
                    + "|" + sanitize(ipAddress);
            redisTemplate.opsForValue().set(
                    TOTP_PREAUTH_PREFIX + preAuthToken, value, Duration.ofMinutes(5));

            List<String> methods = new ArrayList<>();
            if (user.getTwoFactorSecret() != null) methods.add("TOTP");
            if (Boolean.TRUE.equals(user.getSmsTwoFactorEnabled())) methods.add("SMS");
            if (Boolean.TRUE.equals(user.getEmailTwoFactorEnabled())) methods.add("EMAIL");
            if (Boolean.TRUE.equals(user.getAppTwoFactorEnabled()) && refreshTokenRepository.countByUserId(user.getId()) > 0) {
                methods.add("APP");
            }
            if (Boolean.TRUE.equals(user.getPasskeysEnabled())) methods.add("PASSKEY");

            return TwoFactorPendingResponse.builder()
                    .preAuthToken(preAuthToken)
                    .methods(methods)
                    .defaultMethod(user.getDefaultTwoFactorMethod() != null ? user.getDefaultTwoFactorMethod().name() : (methods.isEmpty() ? null : methods.getFirst()))
                    .build();
        }

        return finalizeLogin(user, request.getDeviceName(), request.getDeviceOs(), ipAddress, false);
    }

    private AuthResponse finalizeLogin(User user, String deviceName,
                                       String deviceOs, String ipAddress, boolean isSignup) {
        if (user.getStatus() != User.AccountStatus.ACTIVE) {
            throw new RuntimeException("Account is not active");
        }

        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);

        String accessToken = jwtUtil.generateAccessToken(user.getId(), user.getEmail());
        String refreshToken = jwtUtil.generateRefreshToken(user.getId(), user.getEmail());

        saveRefreshToken(user.getId(), refreshToken, accessToken, deviceName, deviceOs, ipAddress);

        if (isSignup) {
            emailService.sendSignupNotification(user.getEmail(), user.getFirstName());
        } else {
            emailService.sendLoginNotification(
                    user.getEmail(), user.getFirstName(), deviceName, deviceOs, ipAddress);
        }

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

    @Transactional
    public void secureAccount(User user, String accessToken) {
        // Revoke all refresh tokens and biometric tokens
        refreshTokenRepository.deleteAllByUserId(user.getId());
        biometricService.revokeAllBiometricTokens(user);

        // Set security flags
        user.setForcePasswordReset(true);
        user.setRequireSelfieVerification(true);
        userRepository.save(user);

        // Blacklist the current access token for its remaining validity
        if (accessToken != null) {
            Duration remaining = jwtUtil.getRemainingValidity(accessToken);
            if (!remaining.isZero()) {
                redisTemplate.opsForValue().set(
                        BLACKLIST_PREFIX + hashToken(accessToken),
                        "blacklisted",
                        remaining);
            }
        }

        // Cancel all pending transfers where user is sender
        java.util.List<Transaction> pending = transactionRepository.findAllBySenderIdAndStatus(
                user.getId(), Transaction.TransactionStatus.PENDING);

        for (Transaction t : pending) {
            t.setStatus(Transaction.TransactionStatus.CANCELLED);
            t.setCancelledAt(java.time.LocalDateTime.now());
        }
        transactionRepository.saveAll(pending);
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

        if (user.getStatus() != User.AccountStatus.ACTIVE) {
            throw new RuntimeException("Account is not active");
        }

        String newAccessToken = jwtUtil.generateAccessToken(user.getId(), user.getEmail());
        String newRefreshToken = jwtUtil.generateRefreshToken(user.getId(), user.getEmail());

        saveRefreshToken(user.getId(), newRefreshToken,
                newAccessToken, stored.getDeviceName(), stored.getDeviceOs(), stored.getIpAddress());

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
    public void resetPassword(ResetPasswordRequest request, String ipAddress) {
        verifyOtp(request.getIdentifier(), request.getCode(), "password_reset");

        User user = userRepository
                .findByEmailOrPhone(request.getIdentifier(), request.getIdentifier())
                .orElseThrow(() -> new RuntimeException("User not found"));

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        refreshTokenRepository.deleteAllByUserId(user.getId());
        biometricService.revokeAllBiometricTokens(user);

        notifyPasswordChanged(user, ipAddress);
    }

    // ==================== CHANGE PASSWORD ====================

    @Transactional
    public void changePassword(User user, ChangePasswordRequest request, String ipAddress) {
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            throw new RuntimeException("Current password is incorrect");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setForcePasswordReset(false);
        userRepository.save(user);

        refreshTokenRepository.deleteAllByUserId(user.getId());
        biometricService.revokeAllBiometricTokens(user);

        notifyPasswordChanged(user, ipAddress);
    }

    private void notifyPasswordChanged(User user, String ipAddress) {
        String secureToken = java.util.UUID.randomUUID().toString();
        redisTemplate.opsForValue().set("secure_token:" + secureToken, user.getId().toString(), Duration.ofHours(24));
        emailService.sendPasswordChangedNotification(user.getEmail(), user.getFirstName(), ipAddress, secureToken);
    }

    public void secureAccountWithToken(String token) {
        String userIdStr = redisTemplate.opsForValue().get("secure_token:" + token);
        if (userIdStr == null) {
            throw new RuntimeException("Invalid or expired security token");
        }

        User user = userRepository.findById(java.util.UUID.fromString(userIdStr))
                .orElseThrow(() -> new RuntimeException("User not found"));

        secureAccount(user, null);
        redisTemplate.delete("secure_token:" + token);
    }

    // ==================== TOTP / 2FA ====================

    public TotpSetupResponse initiateTotpSetup(User user) {
        if (Boolean.TRUE.equals(user.getTwoFactorEnabled())) {
            throw new RuntimeException("Two-factor authentication is already enabled");
        }
        String secret = totpService.generateSecret();
        // Store pending secret for 10 minutes — not committed until user confirms
        redisTemplate.opsForValue().set(
                TOTP_SETUP_PREFIX + user.getId(), secret, Duration.ofMinutes(10));
        String qrUri = totpService.getQrUri(secret, user.getEmail(), "AZA");
        return TotpSetupResponse.builder().secret(secret).qrUri(qrUri).build();
    }

    @Transactional
    public RecoveryCodesResponse confirmTotpSetup(User user, String code) {
        String secret = redisTemplate.opsForValue().get(TOTP_SETUP_PREFIX + user.getId());
        if (secret == null) {
            throw new RuntimeException("Setup session expired. Please start 2FA setup again.");
        }
        if (totpService.isCodeInvalid(secret, code)) {
            throw new RuntimeException("Invalid code. Make sure your authenticator app is synced and try again.");
        }
        user.setTwoFactorSecret(totpEncryptionService.encrypt(secret));
        user.setTwoFactorEnabled(true);
        userRepository.save(user);
        redisTemplate.delete(TOTP_SETUP_PREFIX + user.getId());

        List<String> plainCodes = generateAndSaveCodes(user.getId());
        log.info("2FA enabled for user {} — {} recovery codes issued", user.getId(), plainCodes.size());
        return new RecoveryCodesResponse(plainCodes, plainCodes.size());
    }

    @Transactional
    public AuthResponse verifyTotpLogin(TotpLoginRequest request, String ipAddress) {
        rateLimitService.enforceRateLimit("totp_login:" + ipAddress, 5, Duration.ofMinutes(15));

        PreAuthSession session = getPreAuthSession(request.getPreAuthToken());
        User user = session.user();
        String[] parts = session.parts();
        String storedIp = parts.length > 3 ? parts[3] : ipAddress;

        String totpSecret = totpEncryptionService.decrypt(user.getTwoFactorSecret());
        if (totpService.isCodeInvalid(totpSecret, request.getCode())) {
            throw new RuntimeException("Invalid authenticator code");
        }

        // Replay prevention — a TOTP code is valid for one use within its 90-second window
        String replayKey = TOTP_USED_PREFIX + user.getId() + ":" + request.getCode();
        if (Boolean.TRUE.equals(redisTemplate.hasKey(replayKey))) {
            throw new RuntimeException("This code has already been used. Wait for the next code.");
        }
        redisTemplate.opsForValue().set(replayKey, "used", Duration.ofSeconds(90));

        redisTemplate.delete(TOTP_PREAUTH_PREFIX + request.getPreAuthToken());

        return finalizeLogin(user, parts.length > 1 ? parts[1] : null, parts.length > 2 ? parts[2] : null, storedIp, false);
    }

    @Transactional
    public void disableTotp(User user, String code) {
        if (!Boolean.TRUE.equals(user.getTwoFactorEnabled())) {
            throw new RuntimeException("Two-factor authentication is not enabled");
        }
        if (totpService.isCodeInvalid(totpEncryptionService.decrypt(user.getTwoFactorSecret()), code)) {
            throw new RuntimeException("Invalid authenticator code");
        }
        user.setTwoFactorSecret(null);
        user.setTwoFactorEnabled(false);
        userRepository.save(user);
        recoveryCodeRepository.deleteAllByUserId(user.getId());
        log.info("2FA disabled for user {} — recovery codes purged", user.getId());
    }

    @Transactional
    public AuthResponse redeemRecoveryCode(RedeemRecoveryCodeRequest request, String ipAddress) {
        rateLimitService.enforceRateLimit("recovery:" + ipAddress, 5, Duration.ofMinutes(15));

        PreAuthSession session = getPreAuthSession(request.getPreAuthToken());
        User user = session.user();
        String[] parts = session.parts();
        String storedIp = parts.length > 3 ? parts[3] : ipAddress;

        List<RecoveryCode> unused = recoveryCodeRepository.findAllByUserIdAndUsedFalse(user.getId());
        RecoveryCode matched = unused.stream()
                .filter(rc -> passwordEncoder.matches(request.getRecoveryCode(), rc.getCodeHash()))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Invalid or already-used recovery code"));

        matched.setUsed(true);
        matched.setUsedAt(LocalDateTime.now());
        recoveryCodeRepository.save(matched);
        redisTemplate.delete(TOTP_PREAUTH_PREFIX + request.getPreAuthToken());

        long remaining = recoveryCodeRepository.countByUserIdAndUsedFalse(user.getId());
        log.warn("Recovery code used for user {} — {} code(s) remaining", user.getId(), remaining);

        return finalizeLogin(user, parts.length > 1 ? parts[1] : null, parts.length > 2 ? parts[2] : null, storedIp, false);
    }

    @Transactional
    public RecoveryCodesResponse regenerateRecoveryCodes(User user, String totpCode) {
        if (!Boolean.TRUE.equals(user.getTwoFactorEnabled())) {
            throw new RuntimeException("Two-factor authentication is not enabled");
        }
        if (totpService.isCodeInvalid(totpEncryptionService.decrypt(user.getTwoFactorSecret()), totpCode)) {
            throw new RuntimeException("Invalid authenticator code");
        }
        recoveryCodeRepository.deleteAllByUserId(user.getId());
        List<String> plainCodes = generateAndSaveCodes(user.getId());
        log.info("Recovery codes regenerated for user {}", user.getId());
        return new RecoveryCodesResponse(plainCodes, plainCodes.size());
    }

    // ==================== SMS / EMAIL 2FA ====================

    public void initiateSms2faSetup(User user) {
        if (user.getPhone() == null || user.getPhone().isBlank()) {
            throw new RuntimeException("No phone number linked to account");
        }
        sendOtp(user.getPhone(), "sms_2fa_setup");
    }

    @Transactional
    public RecoveryCodesResponse confirmSms2faSetup(User user, String code) {
        verifyOtp(user.getPhone(), code, "sms_2fa_setup");
        
        user.setSmsTwoFactorEnabled(true);
        user.setTwoFactorEnabled(true);
        if (user.getDefaultTwoFactorMethod() == null) {
            user.setDefaultTwoFactorMethod(User.TwoFactorMethod.SMS);
        }
        userRepository.save(user);

        // If this is the first 2FA method, generate recovery codes
        if (recoveryCodeRepository.countByUserIdAndUsedFalse(user.getId()) == 0) {
            List<String> plainCodes = generateAndSaveCodes(user.getId());
            return new RecoveryCodesResponse(plainCodes, plainCodes.size());
        }
        return new RecoveryCodesResponse(new ArrayList<>(), 0);
    }

    public void initiateEmail2faSetup(User user) {
        sendOtp(user.getEmail(), "email_2fa_setup");
    }

    @Transactional
    public RecoveryCodesResponse confirmEmail2faSetup(User user, String code) {
        verifyOtp(user.getEmail(), code, "email_2fa_setup");
        
        user.setEmailTwoFactorEnabled(true);
        user.setTwoFactorEnabled(true);
        if (user.getDefaultTwoFactorMethod() == null) {
            user.setDefaultTwoFactorMethod(User.TwoFactorMethod.EMAIL);
        }
        userRepository.save(user);

        if (recoveryCodeRepository.countByUserIdAndUsedFalse(user.getId()) == 0) {
            List<String> plainCodes = generateAndSaveCodes(user.getId());
            return new RecoveryCodesResponse(plainCodes, plainCodes.size());
        }
        return new RecoveryCodesResponse(new ArrayList<>(), 0);
    }

    @Transactional
    public void toggleApp2fa(User user, boolean enabled) {
        user.setAppTwoFactorEnabled(enabled);
        if (enabled) {
            user.setTwoFactorEnabled(true);
            if (user.getDefaultTwoFactorMethod() == null) {
                user.setDefaultTwoFactorMethod(User.TwoFactorMethod.APP);
            }
        }
        userRepository.save(user);
    }

    public String requestAppApproval(String preAuthToken) {
        PreAuthSession session = getPreAuthSession(preAuthToken);
        String[] parts = session.parts();
        String deviceName = parts.length > 1 ? parts[1] : "Unknown Device";
        String ipAddress  = parts.length > 3 ? parts[3] : "Unknown IP";

        String requestId = UUID.randomUUID().toString();
        redisTemplate.opsForValue().set("login_request:" + requestId, "PENDING", Duration.ofMinutes(5));

        notificationService.sendLoginApprovalRequest(session.user().getId(), deviceName, requestId, ipAddress);
        
        return requestId;
    }

    public void respondToAppApproval(String requestId, boolean approve) {
        String status = redisTemplate.opsForValue().get("login_request:" + requestId);
        if (status == null) {
            throw new RuntimeException("Request expired or invalid.");
        }
        redisTemplate.opsForValue().set("login_request:" + requestId, approve ? "APPROVED" : "DENIED", Duration.ofMinutes(5));
    }

    public AuthResponse checkAppApprovalStatus(String preAuthToken, String requestId) {
        String status = redisTemplate.opsForValue().get("login_request:" + requestId);
        if (status == null) {
            throw new RuntimeException("Request expired or invalid.");
        }
        if ("DENIED".equals(status)) {
            throw new RuntimeException("Login request was denied.");
        }
        if (!"APPROVED".equals(status)) {
            return null; // Still pending
        }

        // Approved! Finalize login.
        PreAuthSession session = getPreAuthSession(preAuthToken);
        User user = session.user();
        String[] parts = session.parts();
        String storedIp = parts.length > 3 ? parts[3] : null;

        redisTemplate.delete(TOTP_PREAUTH_PREFIX + preAuthToken);
        redisTemplate.delete("login_request:" + requestId);

        return finalizeLogin(user, parts.length > 1 ? parts[1] : null, parts.length > 2 ? parts[2] : null, storedIp, false);
    }

    public void requestSms2fa(String preAuthToken) {
        User user = getPreAuthSession(preAuthToken).user();
        if (user.getPhone() == null) throw new RuntimeException("No phone number registered");
        String code = generate2faOtp();
        redisTemplate.opsForValue().set(OTP_PREFIX + user.getPhone() + ":2fa", code, Duration.ofMinutes(5));
        smsService.sendOtp(user.getPhone(), code);
    }

    public void requestEmail2fa(String preAuthToken) {
        User user = getPreAuthSession(preAuthToken).user();
        if (user.getEmail() == null) throw new RuntimeException("No email registered");
        String code = generate2faOtp();
        redisTemplate.opsForValue().set(OTP_PREFIX + user.getEmail() + ":2fa", code, Duration.ofMinutes(5));
        emailService.sendOtp(user.getEmail(), code);
    }

    public AuthResponse verify2faOtp(String preAuthToken, String code, String method) {
        PreAuthSession session = getPreAuthSession(preAuthToken);
        User user = session.user();
        String[] parts = session.parts();
        
        String identifier = "SMS".equals(method) ? user.getPhone() : user.getEmail();
        String storedCode = redisTemplate.opsForValue().get(OTP_PREFIX + identifier + ":2fa");
        
        if (storedCode == null || !storedCode.equals(code)) {
            throw new RuntimeException("Invalid or expired code");
        }
        
        redisTemplate.delete(OTP_PREFIX + identifier + ":2fa");
        redisTemplate.delete(TOTP_PREAUTH_PREFIX + preAuthToken);
        
        return finalizeLogin(user, parts.length > 1 ? parts[1] : null, parts.length > 2 ? parts[2] : null, parts.length > 3 ? parts[3] : null, false);
    }

    // ── Recovery-code helpers ─────────────────────────────────────────────────

    private List<String> generateAndSaveCodes(UUID userId) {
        SecureRandom rng = new SecureRandom();
        List<String> plain = new ArrayList<>(RECOVERY_CODE_COUNT);
        List<RecoveryCode> entities = new ArrayList<>(RECOVERY_CODE_COUNT);

        for (int i = 0; i < RECOVERY_CODE_COUNT; i++) {
            // Format: "XXXX-XXXX-XXXX" — 12 hex chars split into 3 groups for readability
            String code = String.format("%04x-%04x-%04x",
                    rng.nextInt(0x10000), rng.nextInt(0x10000), rng.nextInt(0x10000));
            plain.add(code);
            entities.add(RecoveryCode.builder()
                    .userId(userId)
                    .codeHash(passwordEncoder.encode(code))
                    .build());
        }

        recoveryCodeRepository.saveAll(entities);
        return plain;
    }

    // ==================== HELPERS ====================

    public void saveRefreshToken(UUID userId, String rawRefreshToken, String rawAccessToken,
                                 String deviceName, String deviceOs, String ipAddress) {
        Duration accessValidity = jwtUtil.getRemainingValidity(rawAccessToken);
        LocalDateTime accessExpiresAt = accessValidity.isZero()
                ? LocalDateTime.now()
                : LocalDateTime.now().plus(accessValidity);
        RefreshToken rt = RefreshToken.builder()
                .userId(userId)
                .tokenHash(hashToken(rawRefreshToken))
                .accessTokenHash(hashToken(rawAccessToken))
                .accessTokenExpiresAt(accessExpiresAt)
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

    private String sanitize(String value) {
        return value != null ? value.replace("|", "") : "";
    }

    private record PreAuthSession(User user, String[] parts) {}

    private PreAuthSession getPreAuthSession(String preAuthToken) {
        String value = redisTemplate.opsForValue().get(TOTP_PREAUTH_PREFIX + preAuthToken);
        if (value == null) {
            throw new RuntimeException("Session expired or invalid. Please log in again.");
        }
        String[] parts = value.split("\\|", 4);
        User user = userRepository.findById(UUID.fromString(parts[0]))
                .orElseThrow(() -> new RuntimeException("User not found"));
        return new PreAuthSession(user, parts);
    }

    private String generate2faOtp() {
        return String.format("%06d", new java.security.SecureRandom().nextInt(1_000_000));
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
