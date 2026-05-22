package com.aza.backend.service;

import com.aza.backend.entity.User;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.util.EmailService;
import com.aza.backend.util.SmsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class BirthdayService {

    private final UserRepository userRepository;
    private final EmailService emailService;
    private final SmsService smsService;

    /**
     * Runs daily to find active users whose birthday (month and day) is today,
     * and sends them birthday greetings via email and SMS.
     * Cron expression defaults to "0 0 9 * * *" (9:00 AM daily), but can be overridden.
     */
    @Scheduled(cron = "${app.birthday-cron:0 0 9 * * *}")
    public void processBirthdays() {
        LocalDate today = LocalDate.now();
        int month = today.getMonthValue();
        int day = today.getDayOfMonth();

        log.info("Starting daily birthday check for date (MM-DD): {}-{}", String.format("%02d", month), String.format("%02d", day));

        List<User> birthdayUsers = new ArrayList<>(userRepository.findActiveUsersByBirthdayMonthAndDay(month, day));

        // Handle Feb 29 on non-leap years
        boolean isLeapYear = today.isLeapYear();
        if (month == 2 && day == 28 && !isLeapYear) {
            log.info("It is Feb 28th in a non-leap year. Including Feb 29th birthdays.");
            List<User> leapYearUsers = userRepository.findActiveUsersByBirthdayMonthAndDay(2, 29);
            birthdayUsers.addAll(leapYearUsers);
        }

        if (birthdayUsers.isEmpty()) {
            log.info("No users have birthdays today ({}-{})", String.format("%02d", month), String.format("%02d", day));
            return;
        }

        log.info("Found {} active user(s) with birthday today. Sending birthday messages...", birthdayUsers.size());

        for (User user : birthdayUsers) {
            String firstName = user.getFirstName() != null ? user.getFirstName() : "there";

            // 1. Send Email
            if (user.getEmail() != null && !user.getEmail().isBlank()) {
                try {
                    emailService.sendBirthdayEmail(user.getEmail(), firstName);
                    log.info("Queued birthday email for user: {} ({})", user.getId(), user.getEmail());
                } catch (Exception e) {
                    log.error("Failed to queue birthday email for user {}: {}", user.getId(), e.getMessage());
                }
            }

            // 2. Send SMS
            if (user.getPhoneNumber() != null && !user.getPhoneNumber().isBlank()) {
                try {
                    smsService.sendBirthdaySms(user.getPhoneNumber(), firstName);
                    log.info("Sent birthday SMS for user: {} ({})", user.getId(), user.getPhoneNumber());
                } catch (Exception e) {
                    log.error("Failed to send birthday SMS for user {}: {}", user.getId(), e.getMessage());
                }
            }
        }

        log.info("Daily birthday checks completed.");
    }
}
