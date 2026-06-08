package com.aza.backend.service;

import com.aza.backend.dto.oauth.*;
import com.aza.backend.dto.qrlogin.QrSessionData;
import com.aza.backend.entity.OAuthAccessToken;
import com.aza.backend.entity.OAuthClient;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.OAuthAccessTokenRepository;
import com.aza.backend.repository.OAuthClientRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.WalletRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class OAuthService {

    private static final Set<String> VALID_SCOPES = Set.of("identity", "email", "phone", "wallet:read");
    private static final long ACCESS_TOKEN_TTL_SECONDS  = 3600;       // 1 hour
    private static final long REFRESH_TOKEN_TTL_SECONDS = 30L * 24 * 3600; // 30 days
    private static final long AUTH_CODE_TTL_SECONDS     = 60;

    private static final String AUTH_CODE_PREFIX = "oauth:code:";

    private final OAuthClientRepository     clientRepository;
    private final OAuthAccessTokenRepository tokenRepository;
    private final UserRepository             userRepository;
    private final WalletRepository           walletRepository;
    private final PasswordEncoder            passwordEncoder;
    private final StringRedisTemplate        redisTemplate;
    private final ObjectMapper               objectMapper;

    // ── Client registration ───────────────────────────────────────────────────

    @Transactional
    public OAuthClientResponse registerClient(User owner, OAuthClientRegistrationRequest req) {
        validateScopes(req.getScopes());
        validateRedirectUris(req.getRedirectUris());

        String clientId     = "aza_" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String clientSecret = UUID.randomUUID().toString().replace("-", "");

        OAuthClient client = OAuthClient.builder()
                .clientId(clientId)
                .clientSecretHash(passwordEncoder.encode(clientSecret))
                .appName(req.getAppName())
                .appDescription(req.getAppDescription())
                .logoUrl(req.getLogoUrl())
                .websiteUrl(req.getWebsiteUrl())
                .redirectUris(String.join(",", req.getRedirectUris()))
                .allowedScopes(String.join(",", req.getScopes()))
                .owner(owner)
                .build();

        clientRepository.save(client);

        return toResponse(client, clientSecret);
    }

    public List<OAuthClientResponse> listClients(User owner) {
        return clientRepository.findByOwnerOrderByCreatedAtDesc(owner)
                .stream()
                .map(c -> toResponse(c, null))
                .collect(Collectors.toList());
    }

    public OAuthClientResponse getClient(User owner, String clientId) {
        OAuthClient client = requireClientOwnedBy(clientId, owner);
        return toResponse(client, null);
    }

    @Transactional
    public OAuthClientResponse rotateSecret(User owner, String clientId) {
        OAuthClient client = requireClientOwnedBy(clientId, owner);
        String newSecret = UUID.randomUUID().toString().replace("-", "");
        client.setClientSecretHash(passwordEncoder.encode(newSecret));
        return toResponse(client, newSecret);
    }

    @Transactional
    public void deleteClient(User owner, String clientId) {
        OAuthClient client = requireClientOwnedBy(clientId, owner);
        client.setActive(false);
    }

    public OAuthPublicClientResponse getPublicClientInfo(String clientId) {
        OAuthClient client = clientRepository.findByClientIdAndActiveTrue(clientId)
                .orElseThrow(() -> new AppException("OAUTH_CLIENT_NOT_FOUND", "Unknown client.", HttpStatus.NOT_FOUND));
        return OAuthPublicClientResponse.builder()
                .clientId(client.getClientId())
                .appName(client.getAppName())
                .appDescription(client.getAppDescription())
                .logoUrl(client.getLogoUrl())
                .websiteUrl(client.getWebsiteUrl())
                .allowedScopes(client.getAllowedScopeList())
                .build();
    }

    // ── PKCE authorization code flow ──────────────────────────────────────────

    /**
     * Validates the authorization request and stores a pending consent in Redis.
     * Returns the state key the consent page must present to the user.
     */
    public String initiateAuthorize(OAuthAuthorizeRequest req) {
        OAuthClient client = clientRepository.findByClientIdAndActiveTrue(req.getClientId())
                .orElseThrow(() -> new AppException("OAUTH_CLIENT_NOT_FOUND", "Unknown client.", HttpStatus.BAD_REQUEST));

        if (!client.getRedirectUriList().contains(req.getRedirectUri())) {
            throw new AppException("OAUTH_INVALID_REDIRECT", "redirect_uri is not registered for this client.", HttpStatus.BAD_REQUEST);
        }

        List<String> requestedScopes = Arrays.asList(req.getScope().split("[\\s,]+"));
        validateScopes(requestedScopes);

        List<String> disallowed = requestedScopes.stream()
                .filter(s -> !client.getAllowedScopeList().contains(s))
                .toList();
        if (!disallowed.isEmpty()) {
            throw new AppException("OAUTH_SCOPE_NOT_ALLOWED", "Scopes not allowed: " + disallowed, HttpStatus.BAD_REQUEST);
        }

        String pendingKey = "oauth:pending:" + UUID.randomUUID();
        Map<String, Object> pendingData = new LinkedHashMap<>();
        pendingData.put("clientId",           req.getClientId());
        pendingData.put("redirectUri",        req.getRedirectUri());
        pendingData.put("scope",              req.getScope());
        pendingData.put("state",              req.getState());
        pendingData.put("codeChallenge",      req.getCodeChallenge());
        pendingData.put("codeChallengeMethod",req.getCodeChallengeMethod());

        try {
            redisTemplate.opsForValue().set(pendingKey, objectMapper.writeValueAsString(pendingData), 600, TimeUnit.SECONDS);
        } catch (Exception e) {
            throw new AppException("OAUTH_INIT_FAILED", "Failed to initiate authorization.", HttpStatus.INTERNAL_SERVER_ERROR);
        }

        return pendingKey.replace("oauth:pending:", "");
    }

    /**
     * User has approved on the consent page. Issue an auth code and return the redirect URI.
     * Requires the user to be authenticated via their AZA session cookie / JWT.
     */
    @Transactional
    public String approveConsent(User user, String pendingStateKey) {
        String redisKey = "oauth:pending:" + pendingStateKey;
        String json = redisTemplate.opsForValue().getAndDelete(redisKey);
        if (json == null) {
            throw new AppException("OAUTH_EXPIRED", "Authorization request has expired.", HttpStatus.GONE);
        }

        Map<?, ?> data;
        try {
            data = objectMapper.readValue(json, Map.class);
        } catch (Exception e) {
            throw new AppException("OAUTH_INVALID", "Invalid authorization state.", HttpStatus.BAD_REQUEST);
        }

        String clientId   = (String) data.get("clientId");
        String redirectUri = (String) data.get("redirectUri");
        String scope      = (String) data.get("scope");
        String state      = (String) data.get("state");

        OAuthClient client = clientRepository.findByClientIdAndActiveTrue(clientId)
                .orElseThrow(() -> new AppException("OAUTH_CLIENT_NOT_FOUND", "Client not found.", HttpStatus.BAD_REQUEST));

        String code      = UUID.randomUUID().toString().replace("-", "");
        String codeHash  = sha256(code);

        Map<String, Object> codeData = new LinkedHashMap<>();
        codeData.put("clientId",   clientId);
        codeData.put("userId",     user.getId().toString());
        codeData.put("scope",      scope);
        codeData.put("redirectUri",redirectUri);
        codeData.put("codeChallenge",      data.get("codeChallenge"));
        codeData.put("codeChallengeMethod",data.get("codeChallengeMethod"));

        try {
            redisTemplate.opsForValue().set(
                AUTH_CODE_PREFIX + codeHash,
                objectMapper.writeValueAsString(codeData),
                AUTH_CODE_TTL_SECONDS, TimeUnit.SECONDS
            );
        } catch (Exception e) {
            throw new AppException("OAUTH_CODE_FAILED", "Failed to generate authorization code.", HttpStatus.INTERNAL_SERVER_ERROR);
        }

        return redirectUri + "?code=" + code + "&state=" + state;
    }

    // ── Token exchange ────────────────────────────────────────────────────────

    @Transactional
    public OAuthTokenResponse exchangeToken(OAuthTokenRequest req) {
        OAuthClient client = authenticateClient(req.getClientId(), req.getClientSecret());

        return switch (req.getGrantType()) {
            case "authorization_code" -> exchangeAuthCode(client, req);
            case "refresh_token"      -> refreshAccessToken(client, req);
            default -> throw new AppException("OAUTH_UNSUPPORTED_GRANT",
                    "Unsupported grant_type: " + req.getGrantType(), HttpStatus.BAD_REQUEST);
        };
    }

    private OAuthTokenResponse exchangeAuthCode(OAuthClient client, OAuthTokenRequest req) {
        if (req.getCode() == null) throw new AppException("OAUTH_MISSING_CODE", "code is required.", HttpStatus.BAD_REQUEST);

        String codeHash = sha256(req.getCode());
        String json = redisTemplate.opsForValue().getAndDelete(AUTH_CODE_PREFIX + codeHash);
        if (json == null) {
            throw new AppException("OAUTH_INVALID_CODE", "Authorization code is invalid or expired.", HttpStatus.BAD_REQUEST);
        }

        Map<?, ?> codeData;
        try {
            codeData = objectMapper.readValue(json, Map.class);
        } catch (Exception e) {
            throw new AppException("OAUTH_INVALID_CODE", "Invalid code data.", HttpStatus.BAD_REQUEST);
        }

        if (!client.getClientId().equals(codeData.get("clientId"))) {
            throw new AppException("OAUTH_CLIENT_MISMATCH", "Code was not issued for this client.", HttpStatus.BAD_REQUEST);
        }
        if (req.getRedirectUri() != null && !req.getRedirectUri().equals(codeData.get("redirectUri"))) {
            throw new AppException("OAUTH_REDIRECT_MISMATCH", "redirect_uri mismatch.", HttpStatus.BAD_REQUEST);
        }

        // PKCE verification
        String codeChallenge = (String) codeData.get("codeChallenge");
        if (codeChallenge != null) {
            if (req.getCodeVerifier() == null) {
                throw new AppException("OAUTH_MISSING_VERIFIER", "code_verifier is required.", HttpStatus.BAD_REQUEST);
            }
            String computedChallenge = base64UrlSha256(req.getCodeVerifier());
            if (!constantTimeEquals(codeChallenge, computedChallenge)) {
                throw new AppException("OAUTH_PKCE_FAILED", "code_verifier does not match code_challenge.", HttpStatus.BAD_REQUEST);
            }
        }

        UUID userId = UUID.fromString((String) codeData.get("userId"));
        User user   = userRepository.findById(userId)
                .orElseThrow(() -> new AppException("USER_NOT_FOUND", "User not found.", HttpStatus.NOT_FOUND));

        String scope = (String) codeData.get("scope");
        return issueTokenPair(client, user, scope);
    }

    private OAuthTokenResponse refreshAccessToken(OAuthClient client, OAuthTokenRequest req) {
        if (req.getRefreshToken() == null) throw new AppException("OAUTH_MISSING_REFRESH", "refresh_token is required.", HttpStatus.BAD_REQUEST);

        String hash  = sha256(req.getRefreshToken());
        OAuthAccessToken token = tokenRepository.findByRefreshTokenHash(hash)
                .orElseThrow(() -> new AppException("OAUTH_INVALID_REFRESH", "Invalid or expired refresh token.", HttpStatus.UNAUTHORIZED));

        if (token.isRevoked() || token.isRefreshExpired()) {
            throw new AppException("OAUTH_INVALID_REFRESH", "Refresh token has expired.", HttpStatus.UNAUTHORIZED);
        }
        if (!token.getClient().getClientId().equals(client.getClientId())) {
            throw new AppException("OAUTH_CLIENT_MISMATCH", "Refresh token was not issued for this client.", HttpStatus.BAD_REQUEST);
        }

        token.setRevoked(true);
        return issueTokenPair(client, token.getUser(), token.getScopes());
    }

    // ── QR OAuth flow ─────────────────────────────────────────────────────────

    /**
     * Validates client credentials and requested scopes, then returns the data
     * the QrLoginService needs to generate a THIRD_PARTY QR session.
     * Returns: [validatedClientId, validatedScopesCommaSeparated]
     */
    public String[] validateQrOAuthRequest(String clientId, String clientSecret, List<String> scopes) {
        OAuthClient client = authenticateClient(clientId, clientSecret);
        validateScopes(scopes);

        List<String> disallowed = scopes.stream()
                .filter(s -> !client.getAllowedScopeList().contains(s))
                .toList();
        if (!disallowed.isEmpty()) {
            throw new AppException("OAUTH_SCOPE_NOT_ALLOWED", "Scopes not allowed: " + disallowed, HttpStatus.BAD_REQUEST);
        }

        return new String[]{ client.getClientId(), String.join(",", scopes) };
    }

    /**
     * After the QR session is APPROVED and consumed, issue an OAuth token pair.
     */
    @Transactional
    public OAuthTokenResponse completeQrOAuth(QrSessionData session) {
        OAuthClient client = clientRepository.findByClientIdAndActiveTrue(session.getOauthClientId())
                .orElseThrow(() -> new AppException("OAUTH_CLIENT_NOT_FOUND", "Client not found.", HttpStatus.NOT_FOUND));

        User user = userRepository.findById(UUID.fromString(session.getUserId()))
                .orElseThrow(() -> new AppException("USER_NOT_FOUND", "User not found.", HttpStatus.NOT_FOUND));

        return issueTokenPair(client, user, session.getOauthScopes());
    }

    // ── Userinfo ──────────────────────────────────────────────────────────────

    public OAuthUserInfoResponse getUserInfo(String bearerToken) {
        String hash  = sha256(bearerToken);
        OAuthAccessToken token = tokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new AppException("OAUTH_INVALID_TOKEN", "Invalid access token.", HttpStatus.UNAUTHORIZED));

        if (token.isRevoked() || token.isExpired()) {
            throw new AppException("OAUTH_TOKEN_EXPIRED", "Access token has expired.", HttpStatus.UNAUTHORIZED);
        }

        User user   = token.getUser();
        List<String> scopes = token.getScopeList();

        OAuthUserInfoResponse.OAuthUserInfoResponseBuilder builder = OAuthUserInfoResponse.builder()
                .sub(user.getId().toString());

        if (scopes.contains("identity")) {
            builder.name(user.getFirstName() + " " + user.getLastName())
                   .username(user.getUsername())
                   .profileImage(user.getProfileImageUrl());
        }
        if (scopes.contains("email")) {
            builder.email(user.getEmail());
        }
        if (scopes.contains("phone")) {
            builder.phone(user.getPhoneNumber());
        }
        if (scopes.contains("wallet:read")) {
            walletRepository.findByUserId(user.getId()).ifPresent(w -> {
                builder.walletBalance(w.getBalance().toPlainString());
                builder.walletCurrency(w.getCurrency());
            });
        }

        return builder.build();
    }

    // ── Revoke ────────────────────────────────────────────────────────────────

    @Transactional
    public void revokeToken(String clientId, String clientSecret, String token) {
        authenticateClient(clientId, clientSecret);
        String hash = sha256(token);
        tokenRepository.findByTokenHash(hash).ifPresent(t -> t.setRevoked(true));
        tokenRepository.findByRefreshTokenHash(hash).ifPresent(t -> t.setRevoked(true));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private OAuthTokenResponse issueTokenPair(OAuthClient client, User user, String scopes) {
        String accessToken  = UUID.randomUUID().toString().replace("-", "");
        String refreshToken = UUID.randomUUID().toString().replace("-", "");

        OAuthAccessToken entity = OAuthAccessToken.builder()
                .client(client)
                .user(user)
                .tokenHash(sha256(accessToken))
                .scopes(scopes)
                .expiresAt(LocalDateTime.now().plusSeconds(ACCESS_TOKEN_TTL_SECONDS))
                .refreshTokenHash(sha256(refreshToken))
                .refreshExpiresAt(LocalDateTime.now().plusSeconds(REFRESH_TOKEN_TTL_SECONDS))
                .build();

        tokenRepository.save(entity);

        return OAuthTokenResponse.builder()
                .accessToken(accessToken)
                .tokenType("Bearer")
                .expiresIn(ACCESS_TOKEN_TTL_SECONDS)
                .refreshToken(refreshToken)
                .scope(scopes.replace(",", " "))
                .build();
    }

    private OAuthClient authenticateClient(String clientId, String clientSecret) {
        OAuthClient client = clientRepository.findByClientIdAndActiveTrue(clientId)
                .orElseThrow(() -> new AppException("OAUTH_INVALID_CLIENT", "Invalid client credentials.", HttpStatus.UNAUTHORIZED));

        if (!passwordEncoder.matches(clientSecret, client.getClientSecretHash())) {
            throw new AppException("OAUTH_INVALID_CLIENT", "Invalid client credentials.", HttpStatus.UNAUTHORIZED);
        }
        return client;
    }

    private OAuthClient requireClientOwnedBy(String clientId, User owner) {
        return clientRepository.findByClientId(clientId)
                .filter(c -> c.getOwner().getId().equals(owner.getId()))
                .orElseThrow(() -> new AppException("OAUTH_CLIENT_NOT_FOUND", "Client not found.", HttpStatus.NOT_FOUND));
    }

    private void validateScopes(List<String> scopes) {
        List<String> invalid = scopes.stream().filter(s -> !VALID_SCOPES.contains(s)).toList();
        if (!invalid.isEmpty()) {
            throw new AppException("OAUTH_INVALID_SCOPE",
                    "Invalid scopes: " + invalid + ". Valid scopes: " + VALID_SCOPES, HttpStatus.BAD_REQUEST);
        }
    }

    private void validateRedirectUris(List<String> uris) {
        for (String uri : uris) {
            if (!uri.startsWith("https://") && !uri.startsWith("http://localhost")) {
                throw new AppException("OAUTH_INVALID_REDIRECT",
                        "Redirect URIs must use HTTPS (or http://localhost for development).", HttpStatus.BAD_REQUEST);
            }
        }
    }

    private OAuthClientResponse toResponse(OAuthClient client, String plaintextSecret) {
        return OAuthClientResponse.builder()
                .id(client.getId().toString())
                .clientId(client.getClientId())
                .clientSecret(plaintextSecret)
                .appName(client.getAppName())
                .appDescription(client.getAppDescription())
                .logoUrl(client.getLogoUrl())
                .websiteUrl(client.getWebsiteUrl())
                .redirectUris(client.getRedirectUriList())
                .allowedScopes(client.getAllowedScopeList())
                .active(client.isActive())
                .createdAt(client.getCreatedAt() != null ? client.getCreatedAt().toString() : null)
                .build();
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

    private String base64UrlSha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.US_ASCII));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
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
