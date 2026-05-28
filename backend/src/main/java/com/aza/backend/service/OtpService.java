package com.aza.backend.service;

import com.aza.backend.util.EmailService;
import com.aza.backend.util.RateLimitService;
import com.aza.backend.util.SmsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.security.SecureRandom;
import com.aza.backend.exception.AppException;

@Service
@RequiredArgsConstructor
@Slf4j
public class OtpService {

    private final StringRedisTemplate redisTemplate;
    private final SmsService smsService;
    private final EmailService emailService;
    private final RateLimitService rateLimitService;

    private static final String OTP_PREFIX = "otp:";

    public void sendOtp(String identifier, String purpose) {
        rateLimitService.enforceRateLimit("otp:" + identifier, 3, Duration.ofMinutes(10));

        String otp = generateOtpCode();
        String key = getOtpKey(purpose, identifier);
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
            redisTemplate.delete(getOtpKey(purpose, identifier));
            redisTemplate.delete(attemptKey);
            throw new AppException("Too many failed OTP attempts. Request a new code.");
        }

        String key = getOtpKey(purpose, identifier);
        String storedOtp = redisTemplate.opsForValue().get(key);

        if (storedOtp == null) {
            throw new AppException("OTP expired or not found");
        }
        if (!storedOtp.equals(code)) {
            redisTemplate.opsForValue().set(attemptKey,
                    String.valueOf(attempts + 1), Duration.ofMinutes(5));
            throw new AppException("Invalid OTP code.");
        }

        redisTemplate.delete(key);
        redisTemplate.delete(attemptKey);
    }

    public String generateOtpCode() {
        return String.format("%06d", new SecureRandom().nextInt(1_000_000));
    }

    private String getOtpKey(String purpose, String identifier) {
        return OTP_PREFIX + purpose + ":" + identifier;
    }
}
