package com.aza.backend.service;

import com.aza.backend.entity.WaitlistEntry;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.WaitlistRepository;
import com.aza.backend.util.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@Service
@RequiredArgsConstructor
@Slf4j
public class WaitlistService {

    private final WaitlistRepository waitlistRepository;
    private final EmailService emailService;

    @Value("${app.base-url:https://aza.systems}")
    private String appBaseUrl;

    public long register(String rawEmail, String ipAddress) {
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

        return waitlistRepository.countByCreatedAtLessThanEqual(entry.getCreatedAt());
    }

    public long count() {
        return waitlistRepository.count();
    }

    public void invite(UUID id) {
        WaitlistEntry entry = waitlistRepository.findById(id)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Waitlist entry not found", HttpStatus.NOT_FOUND));

        String code = UUID.randomUUID().toString().replace("-", "");
        entry.setInviteCode(code);
        entry.setInvitedAt(LocalDateTime.now());
        waitlistRepository.save(entry);

        String inviteUrl = appBaseUrl + "/signup?invite=" + code;
        CompletableFuture.runAsync(() -> {
            try {
                emailService.sendWaitlistInvitationEmail(entry.getEmail(), inviteUrl);
            } catch (Exception e) {
                log.warn("Waitlist invitation email failed for entry {}: {}", id, e.getMessage());
            }
        });
    }
}
