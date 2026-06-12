package com.aza.backend.service;

import com.aza.backend.dto.admin.BroadcastNotificationRequest;
import com.aza.backend.entity.Notification;
import com.aza.backend.entity.User;
import com.aza.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Mass push to users. Extracted from AdminNotificationController so the
 * maker-checker approval flow can execute it after a second ADMIN approves.
 */
@Service
@RequiredArgsConstructor
public class BroadcastNotificationService {

    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public int broadcast(BroadcastNotificationRequest request) {
        String audience = request.getAudience() != null ? request.getAudience().toUpperCase() : "ALL";
        List<User> recipients = switch (audience) {
            case "KYC_VERIFIED" -> userRepository.findAllByKycStatus(User.KycStatus.VERIFIED);
            case "ACTIVE_ONLY" -> userRepository.findAllByStatus(User.AccountStatus.ACTIVE);
            default -> userRepository.findAll();
        };
        recipients.forEach(u -> notificationService.sendNotificationWithImage(
                u.getId(),
                Notification.NotificationType.SYSTEM_BROADCAST,
                request.getTitle(),
                request.getBody(),
                null,
                null,
                request.getImageUrl()));
        return recipients.size();
    }
}
