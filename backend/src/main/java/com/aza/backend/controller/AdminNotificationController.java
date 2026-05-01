package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.BroadcastNotificationRequest;
import com.aza.backend.entity.Notification;
import com.aza.backend.entity.User;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.service.AdminAuditService;
import com.aza.backend.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/notifications")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminNotificationController {

    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final AdminAuditService auditService;

    @PostMapping("/broadcast")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> broadcast(
            @RequestBody BroadcastNotificationRequest request,
            @AuthenticationPrincipal User admin) {

        String audience = request.getAudience() != null ? request.getAudience().toUpperCase() : "ALL";

        List<User> recipients = switch (audience) {
            case "KYC_VERIFIED" -> userRepository.findAllByKycStatus(User.KycStatus.VERIFIED);
            case "ACTIVE_ONLY" -> userRepository.findAllByStatus(User.AccountStatus.ACTIVE);
            default -> userRepository.findAll();
        };

        recipients.forEach(u -> notificationService.sendNotification(
                u.getId(),
                Notification.NotificationType.SYSTEM_BROADCAST,
                request.getTitle(),
                request.getBody(),
                null));

        auditService.log(admin, "BROADCAST_NOTIFICATION", null,
                "audience=" + audience
                        + " title=" + request.getTitle()
                        + " recipients=" + recipients.size());

        return ResponseEntity.ok(ApiResponse.success(Map.of("sent", recipients.size())));
    }
}
