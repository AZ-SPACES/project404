package com.aza.backend.service;

import com.aza.backend.exception.AppException;
import com.aza.backend.util.EmailService;
import com.aza.backend.util.RateLimitService;
import com.aza.backend.util.SmsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.test.context.ActiveProfiles;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class OtpServiceTest {

    @Autowired OtpService otpService;

    @MockitoBean StringRedisTemplate redisTemplate;
    @MockitoBean SmsService smsService;
    @MockitoBean EmailService emailService;
    @MockitoBean RateLimitService rateLimitService;
    @MockitoBean RedisMessageListenerContainer redisMessageListenerContainer;

    @SuppressWarnings("unchecked")
    private ValueOperations<String, String> valueOps = mock(ValueOperations.class);

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
    }

    @Test
    void sendOtp_toEmailAddress_routesToEmailService() {
        when(emailService.sendOtp(anyString(), anyString())).thenReturn(true);

        otpService.sendOtp("user@example.com", "login");

        verify(emailService).sendOtp(eq("user@example.com"), anyString());
        verify(smsService, never()).sendOtp(anyString(), anyString());
    }

    @Test
    void sendOtp_toPhoneNumber_routesToSmsService() {
        when(smsService.sendOtp(anyString(), anyString())).thenReturn(true);

        otpService.sendOtp("+233201234567", "login");

        verify(smsService).sendOtp(eq("+233201234567"), anyString());
        verify(emailService, never()).sendOtp(anyString(), anyString());
    }

    @Test
    void sendOtp_storesCodeInRedisWithFiveMinuteTtl() {
        when(emailService.sendOtp(anyString(), anyString())).thenReturn(true);

        otpService.sendOtp("user@example.com", "password_reset");

        verify(valueOps).set(eq("otp:password_reset:user@example.com"), anyString(), eq(Duration.ofMinutes(5)));
    }

    @Test
    void verifyOtp_correctCode_deletesRedisKeys() {
        when(valueOps.get("otp:attempts:login:user@example.com")).thenReturn(null);
        when(valueOps.get("otp:login:user@example.com")).thenReturn("123456");

        otpService.verifyOtp("user@example.com", "123456", "login");

        verify(redisTemplate).delete("otp:login:user@example.com");
        verify(redisTemplate).delete("otp:attempts:login:user@example.com");
    }

    @Test
    void verifyOtp_expiredCode_throwsAppException() {
        when(valueOps.get("otp:attempts:login:user@example.com")).thenReturn(null);
        when(valueOps.get("otp:login:user@example.com")).thenReturn(null);

        AppException ex = assertThrows(AppException.class,
                () -> otpService.verifyOtp("user@example.com", "123456", "login"));

        assertTrue(ex.getMessage().contains("expired"));
    }

    @Test
    void verifyOtp_wrongCode_incrementsAttemptCounter() {
        when(valueOps.get("otp:attempts:login:user@example.com")).thenReturn("1");
        when(valueOps.get("otp:login:user@example.com")).thenReturn("999999");

        assertThrows(AppException.class,
                () -> otpService.verifyOtp("user@example.com", "123456", "login"));

        verify(valueOps).set(eq("otp:attempts:login:user@example.com"), eq("2"), any(Duration.class));
    }

    @Test
    void verifyOtp_fiveFailedAttempts_throwsAndClearsCode() {
        when(valueOps.get("otp:attempts:login:user@example.com")).thenReturn("5");

        AppException ex = assertThrows(AppException.class,
                () -> otpService.verifyOtp("user@example.com", "123456", "login"));

        assertTrue(ex.getMessage().contains("Too many"));
        // OTP code is invalidated so it cannot be used after lockout
        verify(redisTemplate).delete("otp:login:user@example.com");
        // Counter is preserved with extended TTL — not deleted — so a brute-forcer who
        // requests a new OTP does not immediately get a fresh 5-attempt window
        verify(redisTemplate, never()).delete("otp:attempts:login:user@example.com");
        verify(redisTemplate).expire(eq("otp:attempts:login:user@example.com"), eq(Duration.ofMinutes(15)));
    }

    @Test
    void sendOtp_resetsAttemptCounter() {
        when(emailService.sendOtp(anyString(), anyString())).thenReturn(true);

        otpService.sendOtp("user@example.com", "login");

        // Sending a fresh OTP must clear any prior failed-attempt counter so the user
        // can verify the new code even after a previous lockout.
        verify(redisTemplate).delete("otp:attempts:login:user@example.com");
    }

    @Test
    void generateOtpCode_alwaysReturnsSixDigitString() {
        for (int i = 0; i < 20; i++) {
            String code = otpService.generateOtpCode();
            assertEquals(6, code.length(), "OTP must be exactly 6 chars");
            assertTrue(code.matches("\\d{6}"), "OTP must be all digits: " + code);
        }
    }
}
