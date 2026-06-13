package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.Notification;
import com.aza.backend.entity.User;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.service.AdminAuditService;
import com.aza.backend.service.NotificationService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/bulk")
@RequiredArgsConstructor
public class AdminBulkController {

    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final AdminAuditService auditService;

    @PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE')")
    @PostMapping("/suspend")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> bulkSuspend(
            @RequestBody BulkStatusRequest request,
            @AuthenticationPrincipal User admin) {

        List<User> targets = userRepository.findAllById(request.getUserIds());
        int count = 0;
        for (User u : targets) {
            if (u.getStatus() != User.AccountStatus.SUSPENDED) {
                u.setStatus(User.AccountStatus.SUSPENDED);
                userRepository.save(u);
                auditService.log(admin, "BULK_SUSPEND", u,
                        "reason=" + request.getReason());
                count++;
            }
        }
        return ResponseEntity.ok(ApiResponse.success(Map.of("suspended", count)));
    }

    @PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE')")
    @PostMapping("/activate")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> bulkActivate(
            @RequestBody BulkStatusRequest request,
            @AuthenticationPrincipal User admin) {

        List<User> targets = userRepository.findAllById(request.getUserIds());
        int count = 0;
        for (User u : targets) {
            if (u.getStatus() == User.AccountStatus.SUSPENDED) {
                u.setStatus(User.AccountStatus.ACTIVE);
                userRepository.save(u);
                auditService.log(admin, "BULK_ACTIVATE", u, "bulk reactivation");
                count++;
            }
        }
        return ResponseEntity.ok(ApiResponse.success(Map.of("activated", count)));
    }

    @PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE','SUPPORT')")
    @PostMapping("/notify")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> bulkNotify(
            @RequestBody BulkNotifyRequest request,
            @AuthenticationPrincipal User admin) {

        List<User> targets = request.getUserIds() != null && !request.getUserIds().isEmpty()
                ? userRepository.findAllById(request.getUserIds())
                : userRepository.findAllByStatus(User.AccountStatus.ACTIVE);

        int count = 0;
        for (User u : targets) {
            try {
                notificationService.sendNotification(
                        u.getId(),
                        Notification.NotificationType.SYSTEM_BROADCAST,
                        request.getTitle(),
                        request.getBody(),
                        null);
                count++;
            } catch (Exception ignored) {
            }
        }
        auditService.log(admin, "BULK_NOTIFY", null,
                "sent to " + count + " users: " + request.getTitle());
        return ResponseEntity.ok(ApiResponse.success(Map.of("sent", count)));
    }

    @PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE')")
    @PostMapping("/kyc-approve")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> bulkKycApprove(
            @RequestBody BulkStatusRequest request,
            @AuthenticationPrincipal User admin) {

        List<User> targets = userRepository.findAllById(request.getUserIds());
        int count = 0;
        for (User u : targets) {
            if (u.getKycStatus() == User.KycStatus.UNDER_REVIEW) {
                u.setKycStatus(User.KycStatus.VERIFIED);
                userRepository.save(u);
                auditService.log(admin, "BULK_KYC_APPROVE", u, "bulk KYC approval");
                notificationService.sendNotification(u.getId(),
                        Notification.NotificationType.KYC_APPROVED,
                        "KYC Verified",
                        "Your identity has been verified. You now have full access to AZA.",
                        null);
                count++;
            }
        }
        return ResponseEntity.ok(ApiResponse.success(Map.of("approved", count)));
    }

    @Data
    static class BulkStatusRequest {
        private List<UUID> userIds;
        private String reason;
    }

    @Data
    static class BulkNotifyRequest {
        private List<UUID> userIds; // empty = all active users
        private String title;
        private String body;
    }
}
