package com.aza.backend.security.challenge;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import jakarta.annotation.PostConstruct;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

/**
 * Issues signed challenge tokens when suspicious traffic is detected.
 *
 * Flow:
 *   1. Filter detects suspicious actor → calls issueChallenge(actorKey)
 *   2. Response includes X-Challenge-Token header (client must complete CAPTCHA)
 *   3. Client POSTs to /api/v1/security/verify-challenge with captcha response
 *   4. verifyAndIssueBypass() validates hCaptcha, stores a bypass token in Redis
 *   5. Client sends X-Bypass-Token header on subsequent requests
 *   6. Filter calls hasBypass(actorKey, token) to skip re-challenging verified clients
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChallengeService {

    private final StringRedisTemplate redis;

    @Value("${app.security.hcaptcha.secret:}")
    private String hcaptchaSecret;

    @Value("${app.security.hcaptcha.verify-url:https://hcaptcha.com/siteverify}")
    private String hcaptchaVerifyUrl;

    @Value("${app.security.challenge.hmac-secret:change-me-in-production}")
    private String hmacSecret;

    private static final Duration CHALLENGE_TTL = Duration.ofMinutes(5);
    private static final Duration BYPASS_TTL = Duration.ofMinutes(30);

    private final RestClient restClient = RestClient.create();

    @PostConstruct
    void validateConfig() {
        if (hmacSecret.isBlank()) {
            throw new IllegalStateException(
                "app.security.challenge.hmac-secret must not be blank. " +
                "Set CHALLENGE_HMAC_SECRET. Generate with: openssl rand -hex 32");
        }
    }

    // ── Challenge issuance ────────────────────────────────────────────────────

    public String issueChallenge(String actorKey) {
        String token = UUID.randomUUID().toString();
        redis.opsForValue().set("challenge:pending:" + token, actorKey, CHALLENGE_TTL);
        return token;
    }

    // ── Verification ─────────────────────────────────────────────────────────

    /**
     * Verifies the hCaptcha response and, on success, issues a bypass token.
     * Returns the bypass token, or null if verification failed.
     */
    public String verifyAndIssueBypass(String challengeToken, String captchaResponse, String ip) {
        String actorKey = redis.opsForValue().get("challenge:pending:" + challengeToken);
        if (actorKey == null) return null;

        if (!hcaptchaSecret.isBlank()) {
            try {
                MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
                form.add("response", captchaResponse);
                form.add("remoteip", ip);
                form.add("secret", hcaptchaSecret);
                Map<?, ?> result = restClient.post()
                        .uri(hcaptchaVerifyUrl)
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .body(form)
                        .retrieve()
                        .body(Map.class);

                if (result == null || !Boolean.TRUE.equals(result.get("success"))) {
                    log.warn("hCaptcha verification rejected for actor {}", actorKey);
                    return null;
                }
            } catch (Exception e) {
                log.warn("hCaptcha API error: {}", e.getMessage());
                return null;
            }
        }

        String bypassToken = hmacSign(actorKey + ":" + System.currentTimeMillis());
        redis.opsForValue().set("challenge:bypass:" + actorKey, bypassToken, BYPASS_TTL);
        redis.delete("challenge:pending:" + challengeToken);
        return bypassToken;
    }

    // ── Bypass checking ───────────────────────────────────────────────────────

    public boolean hasBypass(String actorKey, String providedToken) {
        if (providedToken == null || providedToken.isBlank()) return false;
        String stored = redis.opsForValue().get("challenge:bypass:" + actorKey);
        return stored != null && stored.equals(providedToken);
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    private String hmacSign(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(hmacSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException("HmacSHA256 unavailable", e);
        }
    }
}
