package com.aza.backend.service;

import com.aza.backend.entity.WaitlistEntry;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.WaitlistRepository;
import com.aza.backend.util.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@Service
@RequiredArgsConstructor
@Slf4j
public class WaitlistService {

    private final WaitlistRepository waitlistRepository;
    private final EmailService emailService;

    public void register(String rawEmail, String ipAddress) {
        String email = rawEmail.toLowerCase().trim();

        if (waitlistRepository.existsByEmail(email)) {
            throw new AppException("ALREADY_REGISTERED",
                    "You're already on the waitlist.", HttpStatus.CONFLICT);
        }

        WaitlistEntry entry = waitlistRepository.save(
                WaitlistEntry.builder()
                        .email(email)
                        .ipAddress(ipAddress)
                        .build()
        );

        UUID entryId = entry.getId();
        CompletableFuture.runAsync(() -> {
            try {
                emailService.sendWaitlistConfirmation(email);
                waitlistRepository.markConfirmationSent(entryId);
            } catch (Exception e) {
                log.warn("Waitlist confirmation email failed for entry {}: {}", entryId, e.getMessage());
            }
        });
    }
}
