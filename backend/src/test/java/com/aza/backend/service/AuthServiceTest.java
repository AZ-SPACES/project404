package com.aza.backend.service;

import com.aza.backend.dto.auth.*;
import com.aza.backend.entity.*;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.*;
import com.aza.backend.security.JwtUtil;
import com.aza.backend.util.EmailService;
import com.aza.backend.util.RateLimitService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class AuthServiceTest {

    @Autowired AuthService authService;

    @MockitoBean UserRepository userRepository;
    @MockitoBean WalletRepository walletRepository;
    @MockitoBean RefreshTokenRepository refreshTokenRepository;
    @MockitoBean TransactionRepository transactionRepository;
    @MockitoBean PasswordEncoder passwordEncoder;
    @MockitoBean JwtUtil jwtUtil;
    @MockitoBean StringRedisTemplate redisTemplate;
    @MockitoBean EmailService emailService;
    @MockitoBean RateLimitService rateLimitService;
    @MockitoBean UserService userService;
    @MockitoBean OtpService otpService;
    @MockitoBean BiometricService biometricService;
    @MockitoBean TotpService totpService;
    @MockitoBean TotpEncryptionService totpEncryptionService;
    @MockitoBean RecoveryCodeRepository recoveryCodeRepository;
    @MockitoBean NotificationService notificationService;
    @MockitoBean AuditService auditService;
    @MockitoBean GeoLocationService geoLocationService;
    @MockitoBean ScreeningService screeningService;
    @MockitoBean ReferralService referralService;
    @MockitoBean RedisMessageListenerContainer redisMessageListenerContainer;

    @SuppressWarnings("unchecked")
    private ValueOperations<String, String> valueOps = mock(ValueOperations.class);

    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
    }

    // ── Signup ────────────────────────────────────────────────────────────────

    @Test
    void signup_duplicateEmail_throwsConflict() {
        when(userRepository.existsByEmail("alice@example.com")).thenReturn(true);

        AppException ex = assertThrows(AppException.class,
                () -> authService.signup(signupRequest("alice@example.com", "+233200000001"), "1.2.3.4"));

        assertEquals("EMAIL_ALREADY_EXISTS", ex.getCode());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void signup_duplicatePhone_throwsConflict() {
        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(userRepository.existsByPhoneNumber("+233200000001")).thenReturn(true);

        AppException ex = assertThrows(AppException.class,
                () -> authService.signup(signupRequest("new@example.com", "+233200000001"), "1.2.3.4"));

        assertEquals("PHONE_ALREADY_EXISTS", ex.getCode());
    }

    @Test
    void signup_success_createsUserAndWallet() {
        User savedUser = activeUser();
        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(userRepository.existsByPhoneNumber(anyString())).thenReturn(false);
        when(userRepository.save(any(User.class))).thenReturn(savedUser);
        when(walletRepository.save(any(Wallet.class))).thenReturn(new Wallet());
        when(jwtUtil.generateAccessToken(any(), anyString())).thenReturn("access-token");
        when(jwtUtil.generateRefreshToken(any(), anyString())).thenReturn("refresh-token");
        when(jwtUtil.getRemainingValidity(anyString())).thenReturn(Duration.ofHours(1));
        when(refreshTokenRepository.findByUserIdAndDeviceId(any(), any())).thenReturn(Optional.empty());
        when(refreshTokenRepository.save(any())).thenReturn(new RefreshToken());

        authService.signup(signupRequest("new@example.com", "+233200000002"), "1.2.3.4");

        verify(userRepository, times(2)).save(any(User.class));
        verify(walletRepository).save(any(Wallet.class));
        verify(emailService).sendSignupNotification(anyString(), anyString());
    }

    // ── Pre-Login ─────────────────────────────────────────────────────────────

    @Test
    void preLogin_userNotFound_throwsUnauthorized() {
        when(userRepository.findByEmailOrPhoneNumber(anyString(), anyString())).thenReturn(Optional.empty());

        assertThrows(AppException.class,
                () -> authService.preLogin(loginRequest("nobody@example.com", "pass"), "1.2.3.4"));
    }

    @Test
    void preLogin_wrongPassword_throwsUnauthorizedAndSendsAlert() {
        User user = activeUser();
        when(userRepository.findByEmailOrPhoneNumber(anyString(), anyString())).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong", user.getPasswordHash())).thenReturn(false);

        AppException ex = assertThrows(AppException.class,
                () -> authService.preLogin(loginRequest("alice@example.com", "wrong"), "1.2.3.4"));

        assertEquals("INVALID_CREDENTIALS", ex.getCode());
        verify(emailService).sendFailedLoginAlert(anyString(), anyString(), eq("1.2.3.4"));
    }

    @Test
    void preLogin_inactiveAccount_throwsForbidden() {
        User user = User.builder()
                .id(userId).email("alice@example.com").passwordHash("hashed")
                .status(User.AccountStatus.SUSPENDED).build();
        when(userRepository.findByEmailOrPhoneNumber(anyString(), anyString())).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);

        AppException ex = assertThrows(AppException.class,
                () -> authService.preLogin(loginRequest("alice@example.com", "pass"), "1.2.3.4"));

        assertEquals("ACCOUNT_INACTIVE", ex.getCode());
    }

    @Test
    void preLogin_twoFactorEnabled_returnsPendingResponseWithMethods() {
        User user = activeUser();
        user.setTwoFactorEnabled(true);
        user.setTwoFactorSecret("encrypted-secret");
        when(userRepository.findByEmailOrPhoneNumber(anyString(), anyString())).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);
        when(refreshTokenRepository.countByUserId(userId)).thenReturn(0L);

        Object result = authService.preLogin(loginRequest("alice@example.com", "pass"), "1.2.3.4");

        assertInstanceOf(TwoFactorPendingResponse.class, result);
        TwoFactorPendingResponse pending = (TwoFactorPendingResponse) result;
        assertNotNull(pending.getPreAuthToken());
        assertTrue(pending.getMethods().contains("TOTP"));
        verify(valueOps).set(startsWith("totp:preauth:"), anyString(), eq(Duration.ofMinutes(5)));
    }

    // ── Logout ────────────────────────────────────────────────────────────────

    @Test
    void logout_validToken_blacklistsAndDeletesSession() {
        when(jwtUtil.getRemainingValidity("token")).thenReturn(Duration.ofMinutes(30));

        authService.logout("token");

        verify(valueOps).set(startsWith("jwt:blacklist:"), eq("blacklisted"), eq(Duration.ofMinutes(30)));
        verify(refreshTokenRepository).deleteByAccessTokenHash(anyString());
    }

    @Test
    void logout_alreadyExpiredToken_skipsBlacklistButDeletesSession() {
        when(jwtUtil.getRemainingValidity("expired-token")).thenReturn(Duration.ZERO);

        authService.logout("expired-token");

        verify(valueOps, never()).set(anyString(), eq("blacklisted"), any());
        verify(refreshTokenRepository).deleteByAccessTokenHash(anyString());
    }

    @Test
    void logoutEverywhere_revokesAllSessionsAndBiometricTokens() {
        authService.logoutEverywhere(activeUser());

        verify(refreshTokenRepository).deleteAllByUserId(userId);
        verify(biometricService).revokeAllBiometricTokens(any());
    }

    // ── Refresh Token ─────────────────────────────────────────────────────────

    @Test
    void refreshToken_invalidToken_throws() {
        when(jwtUtil.isInvalid("bad")).thenReturn(true);

        RefreshTokenRequest req = new RefreshTokenRequest();
        req.setRefreshToken("bad");
        assertThrows(AppException.class, () -> authService.refreshToken(req));
    }

    @Test
    void refreshToken_wrongTokenType_throws() {
        when(jwtUtil.isInvalid("token")).thenReturn(false);
        when(jwtUtil.getTokenType("token")).thenReturn("ACCESS");

        RefreshTokenRequest req = new RefreshTokenRequest();
        req.setRefreshToken("token");
        assertThrows(AppException.class, () -> authService.refreshToken(req));
    }

    @Test
    void refreshToken_notInDatabase_throws() {
        when(jwtUtil.isInvalid("token")).thenReturn(false);
        when(jwtUtil.getTokenType("token")).thenReturn("REFRESH");
        when(refreshTokenRepository.findByTokenHash(any())).thenReturn(Optional.empty());

        RefreshTokenRequest req = new RefreshTokenRequest();
        req.setRefreshToken("token");
        assertThrows(AppException.class, () -> authService.refreshToken(req));
    }

    @Test
    void refreshToken_expiredStoredToken_deletesAndThrows() {
        RefreshToken expired = RefreshToken.builder()
                .id(UUID.randomUUID())
                .userId(userId)
                .expiresAt(LocalDateTime.now().minusDays(1))
                .deviceName("iPhone").deviceOs("iOS").deviceId("dev").ipAddress("1.2.3.4")
                .build();
        when(jwtUtil.isInvalid("token")).thenReturn(false);
        when(jwtUtil.getTokenType("token")).thenReturn("REFRESH");
        when(refreshTokenRepository.findByTokenHash(any())).thenReturn(Optional.of(expired));

        RefreshTokenRequest req = new RefreshTokenRequest();
        req.setRefreshToken("token");
        assertThrows(AppException.class, () -> authService.refreshToken(req));

        // Expired token must be purged so it cannot be retried
        verify(refreshTokenRepository).delete(expired);
    }

    @Test
    void refreshToken_suspendedUser_throws() {
        RefreshToken stored = RefreshToken.builder()
                .id(UUID.randomUUID()).userId(userId)
                .expiresAt(LocalDateTime.now().plusDays(30))
                .deviceName("iPhone").deviceOs("iOS").deviceId("dev").ipAddress("1.2.3.4")
                .build();
        User suspended = User.builder().id(userId).email("alice@example.com")
                .status(User.AccountStatus.SUSPENDED).build();
        when(jwtUtil.isInvalid("token")).thenReturn(false);
        when(jwtUtil.getTokenType("token")).thenReturn("REFRESH");
        when(refreshTokenRepository.findByTokenHash(any())).thenReturn(Optional.of(stored));
        when(jwtUtil.getUserIdFromToken("token")).thenReturn(userId);
        when(userRepository.findById(userId)).thenReturn(Optional.of(suspended));

        RefreshTokenRequest req = new RefreshTokenRequest();
        req.setRefreshToken("token");
        assertThrows(AppException.class, () -> authService.refreshToken(req));
    }

    @Test
    void refreshToken_success_deletesOldAndIssuesNew() {
        RefreshToken stored = RefreshToken.builder()
                .id(UUID.randomUUID()).userId(userId)
                .expiresAt(LocalDateTime.now().plusDays(30))
                .deviceName("iPhone").deviceOs("iOS 17").deviceId("dev-1").ipAddress("1.2.3.4")
                .build();
        User user = activeUser();
        when(jwtUtil.isInvalid("old-token")).thenReturn(false);
        when(jwtUtil.getTokenType("old-token")).thenReturn("REFRESH");
        when(refreshTokenRepository.findByTokenHash(any())).thenReturn(Optional.of(stored));
        when(jwtUtil.getUserIdFromToken("old-token")).thenReturn(userId);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(jwtUtil.generateAccessToken(userId, user.getEmail())).thenReturn("new-access");
        when(jwtUtil.generateRefreshToken(userId, user.getEmail())).thenReturn("new-refresh");
        when(jwtUtil.getRemainingValidity("new-refresh")).thenReturn(Duration.ofDays(30));
        when(refreshTokenRepository.findByUserIdAndDeviceId(any(), any())).thenReturn(Optional.empty());
        when(refreshTokenRepository.save(any())).thenReturn(new RefreshToken());

        RefreshTokenRequest req = new RefreshTokenRequest();
        req.setRefreshToken("old-token");
        AuthResponse response = authService.refreshToken(req);

        // Old token rotated out
        verify(refreshTokenRepository).delete(stored);
        // New token session persisted
        verify(refreshTokenRepository).save(any());
        assertEquals("new-access", response.getAccessToken());
        assertEquals("new-refresh", response.getRefreshToken());
    }

    // ── Change Password ───────────────────────────────────────────────────────

    @Test
    void changePassword_wrongCurrentPassword_throws() {
        User user = activeUser();
        when(passwordEncoder.matches("wrong", user.getPasswordHash())).thenReturn(false);

        ChangePasswordRequest req = new ChangePasswordRequest();
        req.setCurrentPassword("wrong");
        req.setNewPassword("NewSecure123!");

        assertThrows(AppException.class, () -> authService.changePassword(user, req, "1.2.3.4"));
        verify(userRepository, never()).save(any());
    }

    @Test
    void changePassword_success_updatesHashAndRevokesAllSessions() {
        User user = activeUser();
        when(passwordEncoder.matches("OldPass1!", user.getPasswordHash())).thenReturn(true);
        when(passwordEncoder.encode("NewPass1!")).thenReturn("new-hashed");

        ChangePasswordRequest req = new ChangePasswordRequest();
        req.setCurrentPassword("OldPass1!");
        req.setNewPassword("NewPass1!");

        authService.changePassword(user, req, "1.2.3.4");

        assertEquals("new-hashed", user.getPasswordHash());
        verify(userRepository).save(user);
        // All sessions revoked after password change to prevent session hijacking
        verify(refreshTokenRepository).deleteAllByUserId(userId);
        verify(biometricService).revokeAllBiometricTokens(user);
    }

    // ── TOTP / 2FA ────────────────────────────────────────────────────────────

    @Test
    void disableTotp_notEnabled_throws() {
        assertThrows(AppException.class, () -> authService.disableTotp(activeUser(), "123456"));
        verify(userRepository, never()).save(any());
    }

    @Test
    void disableTotp_invalidCode_throws() {
        User user = activeUser();
        user.setTwoFactorSecret("encrypted-secret");
        when(totpEncryptionService.decrypt("encrypted-secret")).thenReturn("raw-secret");
        when(totpService.isCodeInvalid("raw-secret", "000000")).thenReturn(true);

        assertThrows(AppException.class, () -> authService.disableTotp(user, "000000"));
    }

    @Test
    void setDefaultTwoFactorMethod_unknownMethod_throws() {
        assertThrows(AppException.class,
                () -> authService.setDefaultTwoFactorMethod(activeUser(), "CARRIER_PIGEON"));
    }

    @Test
    void setDefaultTwoFactorMethod_totpNotSetUp_throws() {
        assertThrows(AppException.class,
                () -> authService.setDefaultTwoFactorMethod(activeUser(), "TOTP"));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private User activeUser() {
        return User.builder()
                .id(userId).email("alice@example.com").firstName("Alice").lastName("Smith")
                .passwordHash("hashed").status(User.AccountStatus.ACTIVE)
                .kycStatus(User.KycStatus.VERIFIED)
                .build();
    }

    private SignupRequest signupRequest(String email, String phone) {
        SignupRequest req = new SignupRequest();
        req.setEmail(email);
        req.setPhone(phone);
        req.setPassword("Secure123!");
        req.setFirstName("Alice");
        req.setLastName("Smith");
        req.setHandle("alice");
        return req;
    }

    private LoginRequest loginRequest(String identifier, String password) {
        LoginRequest req = new LoginRequest();
        req.setIdentifier(identifier);
        req.setPassword(password);
        req.setDeviceName("iPhone");
        req.setDeviceOs("iOS 17");
        req.setDeviceId("device-abc");
        return req;
    }
}
