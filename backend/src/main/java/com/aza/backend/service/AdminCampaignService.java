package com.aza.backend.service;

import com.aza.backend.dto.admin.CampaignRequest;
import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.User;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.util.EmailService;
import com.aza.backend.util.SmsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminCampaignService {

    private final UserRepository userRepository;
    private final MerchantRepository merchantRepository;
    private final EmailService emailService;
    private final SmsService smsService;

    public void processCampaign(CampaignRequest request) {
        CompletableFuture.runAsync(() -> {
            log.info("Starting campaign processing for segment: {}, type: {}", request.getSegment(), request.getType());

            List<User> targetUsers = switch (request.getSegment()) {
                case "ALL_USERS" -> userRepository.findAll();
                case "APPROVED_KYC" -> userRepository.findAllByKycStatus(User.KycStatus.VERIFIED);
                case "UNAPPROVED_KYC" -> userRepository.findAllByKycStatus(User.KycStatus.REJECTED);
                case "NOT_STARTED_KYC" -> userRepository.findAllByKycStatus(User.KycStatus.NOT_STARTED);
                case "ACTIVE_USERS" -> userRepository.findAllByStatus(User.AccountStatus.ACTIVE);
                case "MERCHANTS" -> {
                    List<UUID> userIds = merchantRepository.findAll().stream()
                            .map(Merchant::getUserId)
                            .collect(Collectors.toList());
                    yield userRepository.findAllById(userIds);
                }
                default -> throw new IllegalArgumentException("Unknown segment: " + request.getSegment());
            };

            log.info("Campaign target size: {} users", targetUsers.size());

            int successCount = 0;
            int failureCount = 0;

            for (User user : targetUsers) {
                try {
                    if ("EMAIL".equalsIgnoreCase(request.getType())) {
                        if (user.getEmail() != null) {
                            String htmlBody = formatEmailBody(request.getMessage(), user.getFirstName());
                            boolean sent = emailService.sendEmail(user.getEmail(), request.getSubject(), htmlBody);
                            if (sent) successCount++; else failureCount++;
                        }
                    } else if ("SMS".equalsIgnoreCase(request.getType())) {
                        if (user.getPhoneNumber() != null) {
                            boolean sent = smsService.sendSms(user.getPhoneNumber(), request.getMessage());
                            if (sent) successCount++; else failureCount++;
                        }
                    }
                    
                    Thread.sleep(50);
                } catch (Exception e) {
                    failureCount++;
                    log.error("Failed to send campaign message to user {}: {}", user.getId(), e.getMessage());
                }
            }

            log.info("Campaign finished. Type: {}, Segment: {}, Success: {}, Failed: {}", 
                     request.getType(), request.getSegment(), successCount, failureCount);
        });
    }

    private String formatEmailBody(String message, String firstName) {
        // Simple plain-to-html conversion for basic markdown/newlines if needed,
        // or just wrapping the content in a basic div.
        String formattedMessage = message.replace("\n", "<br>");
        String greeting = firstName != null && !firstName.isBlank() ? "Hi " + firstName + ",<br><br>" : "Hi,<br><br>";
        
        return "<html>" +
               "<body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;'>" +
               greeting +
               formattedMessage +
               "<br><br>" +
               "<hr style='border: none; border-top: 1px solid #eee; margin: 20px 0;'>" +
               "<p style='font-size: 12px; color: #999; text-align: center;'>" +
               "&copy; " + java.time.Year.now().getValue() + " AZA. All rights reserved.<br>" +
               "This is an automated message, please do not reply directly to this email." +
               "</p>" +
               "</body>" +
               "</html>";
    }
}
