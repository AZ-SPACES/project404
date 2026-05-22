package com.aza.backend.service;

import com.aza.backend.entity.User;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.util.EmailService;
import com.aza.backend.util.SmsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.*;

class BirthdayServiceTest {

    private BirthdayService birthdayService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private EmailService emailService;

    @Mock
    private SmsService smsService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        birthdayService = new BirthdayService(userRepository, emailService, smsService);
    }

    @Test
    void testProcessBirthdays_SendsEmailAndSms() {
        // Arrange
        LocalDate today = LocalDate.now();
        int month = today.getMonthValue();
        int day = today.getDayOfMonth();

        User user = new User();
        user.setId(UUID.randomUUID());
        user.setFirstName("Alice");
        user.setEmail("alice@example.com");
        user.setPhoneNumber("+2331234567");
        user.setDateOfBirth(today.minusYears(25));
        user.setStatus(User.AccountStatus.ACTIVE);

        List<User> users = new ArrayList<>();
        users.add(user);

        when(userRepository.findActiveUsersByBirthdayMonthAndDay(month, day)).thenReturn(users);

        // Act
        birthdayService.processBirthdays();

        // Assert
        verify(emailService, times(1)).sendBirthdayEmail("alice@example.com", "Alice");
        verify(smsService, times(1)).sendBirthdaySms("+2331234567", "Alice");
    }

    @Test
    void testProcessBirthdays_NoBirthdaysToday() {
        // Arrange
        LocalDate today = LocalDate.now();
        int month = today.getMonthValue();
        int day = today.getDayOfMonth();

        when(userRepository.findActiveUsersByBirthdayMonthAndDay(month, day)).thenReturn(new ArrayList<>());

        // Act
        birthdayService.processBirthdays();

        // Assert
        verify(emailService, never()).sendBirthdayEmail(anyString(), anyString());
        verify(smsService, never()).sendBirthdaySms(anyString(), anyString());
    }
}
