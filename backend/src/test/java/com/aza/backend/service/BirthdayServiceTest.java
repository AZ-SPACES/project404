package com.aza.backend.service;

import com.aza.backend.entity.User;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.util.EmailService;
import com.aza.backend.util.SmsService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class BirthdayServiceTest {

    @Autowired BirthdayService birthdayService;

    @MockitoBean UserRepository userRepository;
    @MockitoBean EmailService emailService;
    @MockitoBean SmsService smsService;
    @MockitoBean StringRedisTemplate stringRedisTemplate;
    @MockitoBean RedisMessageListenerContainer redisMessageListenerContainer;

    @Test
    void testProcessBirthdays_SendsEmailAndSms() {
        LocalDate today = LocalDate.now();
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setFirstName("Alice");
        user.setEmail("alice@example.com");
        user.setPhoneNumber("+2331234567");
        user.setDateOfBirth(today.minusYears(25));
        user.setStatus(User.AccountStatus.ACTIVE);

        when(userRepository.findActiveUsersByBirthdayMonthAndDay(
                today.getMonthValue(), today.getDayOfMonth()))
                .thenReturn(List.of(user));

        birthdayService.processBirthdays();

        verify(emailService).sendBirthdayEmail("alice@example.com", "Alice");
        verify(smsService).sendBirthdaySms("+2331234567", "Alice");
    }

    @Test
    void testProcessBirthdays_NoBirthdaysToday() {
        LocalDate today = LocalDate.now();
        when(userRepository.findActiveUsersByBirthdayMonthAndDay(
                today.getMonthValue(), today.getDayOfMonth()))
                .thenReturn(List.of());

        birthdayService.processBirthdays();

        verify(emailService, never()).sendBirthdayEmail(anyString(), anyString());
        verify(smsService, never()).sendBirthdaySms(anyString(), anyString());
    }
}
