package com.aza.backend.service;

import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.UUID;

/**
 * Session elevation for the admin console. A valid JWT alone is not enough to
 * touch /api/v1/admin/** — the staff member must re-prove identity (TOTP if
 * enrolled, password otherwise), which closes the hole where a hijacked
 * customer session inherits back-office power. Elevation lives in Redis with a
 * sliding TTL, so it expires after 15 minutes of admin inactivity.
 */
@Service
@RequiredArgsConstructor
public class AdminStepUpService {

    private final StringRedisTemplate redisTemplate;
    private final TotpService totpService;
    private final TotpEncryptionService totpEncryptionService;
    private final PasswordEncoder passwordEncoder;
    private final AdminAuditService auditService;

    private static final String ELEVATION_PREFIX = "admin:stepup:";
    private static final String ATTEMPTS_PREFIX = "admin:stepup:attempts:";
    private static final Duration ELEVATION_TTL = Duration.ofMinutes(15);
    private static final Duration ATTEMPT_WINDOW = Duration.ofMinutes(15);
    private static final int MAX_ATTEMPTS = 5;

    public boolean isElevated(UUID userId) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(ELEVATION_PREFIX + userId));
    }

    /** Sliding window: each authorized admin request keeps the elevation alive. */
    public void refresh(UUID userId) {
        redisTemplate.expire(ELEVATION_PREFIX + userId, ELEVATION_TTL);
    }

    /** TOTP when enrolled; password is only the fallback for staff without an authenticator. */
    public String requiredMethod(User user) {
        return user.getTwoFactorSecret() != null ? "TOTP" : "PASSWORD";
    }

    public void verify(User user, String code, String password) {
        String attemptsKey = ATTEMPTS_PREFIX + user.getId();
        Long attempts = redisTemplate.opsForValue().increment(attemptsKey);
        if (attempts != null && attempts == 1L) {
            redisTemplate.expire(attemptsKey, ATTEMPT_WINDOW);
        }
        if (attempts != null && attempts > MAX_ATTEMPTS) {
            throw new AppException("TOO_MANY_ATTEMPTS",
                    "Too many verification attempts — try again later", HttpStatus.TOO_MANY_REQUESTS);
        }

        String method = requiredMethod(user);
        boolean valid;
        if ("TOTP".equals(method)) {
            String secret = totpEncryptionService.decrypt(user.getTwoFactorSecret());
            valid = code != null && !totpService.isCodeInvalid(secret, code);
        } else {
            valid = password != null && passwordEncoder.matches(password, user.getPasswordHash());
        }
        if (!valid) {
            throw new AppException("INVALID_CREDENTIALS",
                    "TOTP".equals(method) ? "Invalid verification code" : "Invalid password",
                    HttpStatus.UNAUTHORIZED);
        }

        redisTemplate.delete(attemptsKey);
        redisTemplate.opsForValue().set(ELEVATION_PREFIX + user.getId(), "1", ELEVATION_TTL);
        auditService.log(user, "ADMIN_STEP_UP", null, "method=" + method);
    }
}
