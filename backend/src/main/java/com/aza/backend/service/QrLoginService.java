package com.aza.backend.service;

import com.aza.backend.dto.auth.AuthResponse;
import com.aza.backend.dto.oauth.OAuthTokenResponse;
import com.aza.backend.dto.qrlogin.*;
import com.aza.backend.dto.websocket.WebSocketEventType;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.*;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
public class QrLoginService {

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;
    private final AuthService authService;
    private final WebSocketPublisher webSocketPublisher;
    private final OAuthService oAuthService;

    public QrLoginService(StringRedisTemplate redisTemplate, ObjectMapper objectMapper,
                          UserRepository userRepository, AuthService authService,
                          WebSocketPublisher webSocketPublisher,
                          @org.springframework.context.annotation.Lazy OAuthService oAuthService) {
        this.redisTemplate      = redisTemplate;
        this.objectMapper       = objectMapper;
        this.userRepository     = userRepository;
        this.authService        = authService;
        this.webSocketPublisher = webSocketPublisher;
        this.oAuthService       = oAuthService;
    }

    private static final String SESSION_PREFIX = "qr:session:";
    private static final long SESSION_TTL_SECONDS = 90;
    private static final int QR_SIZE_PX = 300;

    /**
     * Atomically transitions a session from PENDING → APPROVED.
     * Returns: 1 = success, 0 = expired/missing, -1 = already used.
     * The TTL is preserved from the original key; falls back to ARGV[2] only if the
     * key was somehow stored without an expiry (defensive edge case).
     */
    private static final DefaultRedisScript<Long> AUTHORIZE_SCRIPT = new DefaultRedisScript<>(
        "local data = redis.call('GET', KEYS[1]) " +
        "if not data then return 0 end " +
        "local session = cjson.decode(data) " +
        "if session['status'] ~= 'PENDING' then return -1 end " +
        "session['status'] = 'APPROVED' " +
        "session['userId'] = ARGV[1] " +
        "local ttl = redis.call('TTL', KEYS[1]) " +
        "if ttl < 1 then ttl = tonumber(ARGV[2]) end " +
        "redis.call('SET', KEYS[1], cjson.encode(session), 'EX', ttl) " +
        "return 1",
        Long.class
    );

    public QrLoginInitiateResponse initiateQrLogin(QrSiteType siteType) {
        String challengeToken = UUID.randomUUID().toString();
        String sessionSecret  = UUID.randomUUID().toString();
        Instant expiresAt     = Instant.now().plusSeconds(SESSION_TTL_SECONDS);

        // Generate the QR image BEFORE writing to Redis so that a ZXing failure
        // cannot leave an orphaned PENDING session in the store.
        String qrContent = "aza://qr-login?token=" + challengeToken + "&site=" + siteType.name();
        String qrImageBase64;
        try {
            qrImageBase64 = generateQrBase64(qrContent);
        } catch (Exception e) {
            log.error("QR image generation failed", e);
            throw new AppException("QR_INIT_FAILED", "Failed to generate QR code", HttpStatus.INTERNAL_SERVER_ERROR);
        }

        QrSessionData session = QrSessionData.builder()
                .status("PENDING")
                .siteType(siteType.name())
                .sessionSecretHash(sha256(sessionSecret))
                .expiresAtEpoch(expiresAt.getEpochSecond())
                .build();

        try {
            String key = SESSION_PREFIX + challengeToken;
            redisTemplate.opsForValue().set(
                    key, objectMapper.writeValueAsString(session), SESSION_TTL_SECONDS, TimeUnit.SECONDS);
        } catch (Exception e) {
            log.error("Failed to store QR session in Redis", e);
            throw new AppException("QR_INIT_FAILED", "Failed to generate QR code", HttpStatus.INTERNAL_SERVER_ERROR);
        }

        return QrLoginInitiateResponse.builder()
                .challengeToken(challengeToken)
                .sessionSecret(sessionSecret)
                .qrImageBase64(qrImageBase64)
                .expiresAt(expiresAt.toString())
                .ttlSeconds(SESSION_TTL_SECONDS)
                .build();
    }

    /**
     * OAuth QR initiation: validates OAuth client credentials/scopes, then creates a
     * THIRD_PARTY session. The QR encodes a deep link the mobile app knows how to parse.
     */
    public QrLoginInitiateResponse initiateOAuthQrLogin(String clientId, String clientSecret, List<String> scopes) {
        String[] validated    = oAuthService.validateQrOAuthRequest(clientId, clientSecret, scopes);
        String validClientId  = validated[0];
        String validScopes    = validated[1];

        String challengeToken = UUID.randomUUID().toString();
        String sessionSecret  = UUID.randomUUID().toString();
        Instant expiresAt     = Instant.now().plusSeconds(SESSION_TTL_SECONDS);

        String qrContent = "aza://qr-login?token=" + challengeToken
                + "&site=THIRD_PARTY"
                + "&client_id=" + validClientId
                + "&scopes=" + validScopes.replace(",", "%2C");
        String qrImageBase64;
        try {
            qrImageBase64 = generateQrBase64(qrContent);
        } catch (Exception e) {
            log.error("OAuth QR image generation failed", e);
            throw new AppException("QR_INIT_FAILED", "Failed to generate QR code", HttpStatus.INTERNAL_SERVER_ERROR);
        }

        QrSessionData session = QrSessionData.builder()
                .status("PENDING")
                .siteType(QrSiteType.THIRD_PARTY.name())
                .sessionSecretHash(sha256(sessionSecret))
                .expiresAtEpoch(expiresAt.getEpochSecond())
                .oauthClientId(validClientId)
                .oauthScopes(validScopes)
                .build();

        try {
            redisTemplate.opsForValue().set(
                    SESSION_PREFIX + challengeToken,
                    objectMapper.writeValueAsString(session),
                    SESSION_TTL_SECONDS, TimeUnit.SECONDS);
        } catch (Exception e) {
            log.error("Failed to store OAuth QR session in Redis", e);
            throw new AppException("QR_INIT_FAILED", "Failed to generate QR code", HttpStatus.INTERNAL_SERVER_ERROR);
        }

        return QrLoginInitiateResponse.builder()
                .challengeToken(challengeToken)
                .sessionSecret(sessionSecret)
                .qrImageBase64(qrImageBase64)
                .expiresAt(expiresAt.toString())
                .ttlSeconds(SESSION_TTL_SECONDS)
                .build();
    }

    /**
     * After the mobile user has approved a THIRD_PARTY QR session, the third-party server
     * calls this to consume the session and receive an OAuth access token.
     */
    public OAuthTokenResponse completeOAuthQrLogin(String challengeToken, String sessionSecret,
                                                    String clientId, String clientSecret) {
        String key = SESSION_PREFIX + challengeToken;
        String json = redisTemplate.opsForValue().getAndDelete(key);
        if (json == null) {
            throw new AppException("QR_EXPIRED", "QR session has expired or already been used.", HttpStatus.GONE);
        }

        QrSessionData session;
        try {
            session = objectMapper.readValue(json, QrSessionData.class);
        } catch (Exception e) {
            throw new AppException("QR_INVALID", "Invalid QR session.", HttpStatus.BAD_REQUEST);
        }

        if (!"APPROVED".equals(session.getStatus())) {
            throw new AppException("QR_NOT_APPROVED", "QR login has not been approved yet.", HttpStatus.FORBIDDEN);
        }
        if (!constantTimeEquals(sha256(sessionSecret), session.getSessionSecretHash())) {
            throw new AppException("QR_FORBIDDEN", "Session secret mismatch.", HttpStatus.FORBIDDEN);
        }
        if (!clientId.equals(session.getOauthClientId())) {
            throw new AppException("OAUTH_CLIENT_MISMATCH", "client_id does not match the session.", HttpStatus.FORBIDDEN);
        }
        // Re-validate client credentials — defense-in-depth alongside sessionSecret check
        oAuthService.validateQrOAuthRequest(clientId, clientSecret, List.of(session.getOauthScopes().split(",")));

        return oAuthService.completeQrOAuth(session);
    }

    public QrLoginStatusResponse getStatus(String challengeToken) {
        String key = SESSION_PREFIX + challengeToken;
        String json = redisTemplate.opsForValue().get(key);
        if (json == null) {
            return QrLoginStatusResponse.builder().status("EXPIRED").build();
        }
        try {
            QrSessionData session = objectMapper.readValue(json, QrSessionData.class);
            return QrLoginStatusResponse.builder().status(session.getStatus()).build();
        } catch (Exception e) {
            return QrLoginStatusResponse.builder().status("EXPIRED").build();
        }
    }

    public void authorizeQrLogin(String challengeToken, User user) {
        // Read the session first (non-critical read — only for the role check).
        // The actual PENDING→APPROVED transition is done atomically below.
        String key = SESSION_PREFIX + challengeToken;
        String json = redisTemplate.opsForValue().get(key);
        if (json == null) {
            throw new AppException("QR_EXPIRED", "QR code has expired. Please scan again.", HttpStatus.GONE);
        }

        QrSessionData session;
        try {
            session = objectMapper.readValue(json, QrSessionData.class);
        } catch (Exception e) {
            throw new AppException("QR_INVALID", "Invalid QR session.", HttpStatus.BAD_REQUEST);
        }

        // Reject suspended/deactivated accounts for every site type.
        if (user.getStatus() != User.AccountStatus.ACTIVE) {
            throw new AppException("QR_FORBIDDEN", "Your account is not active.", HttpStatus.FORBIDDEN);
        }

        // Site-specific role guard.
        QrSiteType siteType = QrSiteType.valueOf(session.getSiteType());
        if (siteType == QrSiteType.ADMIN && user.getRole() != User.UserRole.ADMIN) {
            throw new AppException("QR_FORBIDDEN", "Your account does not have access to the Admin Portal.", HttpStatus.FORBIDDEN);
        }

        // Atomically claim the session — first caller wins, prevents double-approval.
        Long result = redisTemplate.execute(
                AUTHORIZE_SCRIPT,
                List.of(key),
                user.getId().toString(),
                String.valueOf(SESSION_TTL_SECONDS)
        );

        if (result == null || result == 0L) {
            throw new AppException("QR_EXPIRED", "QR code has expired. Please scan again.", HttpStatus.GONE);
        }
        if (result == -1L) {
            throw new AppException("QR_ALREADY_USED", "This QR code has already been used.", HttpStatus.CONFLICT);
        }

        webSocketPublisher.publishNotification(user.getId(), WebSocketEventType.QR_LOGIN_APPROVED,
                Map.of("siteType", siteType.name(), "message", "Login to " + siteType.name().toLowerCase() + " portal authorized"));
    }

    public AuthResponse completeQrLogin(String challengeToken, String sessionSecret, String ipAddress) {
        String key = SESSION_PREFIX + challengeToken;

        // Atomically consume — first caller wins, prevents replay.
        String json = redisTemplate.opsForValue().getAndDelete(key);
        if (json == null) {
            throw new AppException("QR_EXPIRED", "QR session has expired or already been used.", HttpStatus.GONE);
        }

        QrSessionData session;
        try {
            session = objectMapper.readValue(json, QrSessionData.class);
        } catch (Exception e) {
            throw new AppException("QR_INVALID", "Invalid QR session.", HttpStatus.BAD_REQUEST);
        }

        if (!"APPROVED".equals(session.getStatus())) {
            throw new AppException("QR_NOT_APPROVED", "QR login has not been approved yet.", HttpStatus.FORBIDDEN);
        }

        // Proof-of-possession: verify the secret only the initiating browser received.
        if (!constantTimeEquals(sha256(sessionSecret), session.getSessionSecretHash())) {
            throw new AppException("QR_FORBIDDEN", "Session secret mismatch.", HttpStatus.FORBIDDEN);
        }

        User user = userRepository.findById(UUID.fromString(session.getUserId()))
                .orElseThrow(() -> new AppException("USER_NOT_FOUND", "User not found.", HttpStatus.NOT_FOUND));

        return authService.completeQrLogin(user, challengeToken, ipAddress);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String generateQrBase64(String content) throws Exception {
        QRCodeWriter writer = new QRCodeWriter();
        BitMatrix matrix = writer.encode(content, BarcodeFormat.QR_CODE, QR_SIZE_PX, QR_SIZE_PX);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        MatrixToImageWriter.writeToStream(matrix, "PNG", out);
        return Base64.getEncoder().encodeToString(out.toByteArray());
    }

    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new AppException("SHA-256 not available", e);
        }
    }

    private boolean constantTimeEquals(String a, String b) {
        return MessageDigest.isEqual(
                a.getBytes(StandardCharsets.UTF_8),
                b.getBytes(StandardCharsets.UTF_8));
    }
}
