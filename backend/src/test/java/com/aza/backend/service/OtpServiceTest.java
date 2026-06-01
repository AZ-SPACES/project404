package com.aza.backend.service;

import com.aza.backend.exception.AppException;
import com.aza.backend.util.EmailService;
import com.aza.backend.util.RateLimitService;
import com.aza.backend.util.SmsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class OtpServiceTest {

    private OtpService otpService;

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private SmsService smsService;
    @Mock private EmailService emailService;
    @Mock private RateLimitService rateLimitService;
    @Mock private ValueOperations<String, String> valueOps;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        otpService = new OtpService(redisTemplate, smsService, emailService, rateLimitService);
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
        verify(redisTemplate).delete("otp:login:user@example.com");
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
