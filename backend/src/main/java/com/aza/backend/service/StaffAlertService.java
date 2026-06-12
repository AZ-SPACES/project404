package com.aza.backend.service;

import com.aza.backend.entity.Notification;
import com.aza.backend.entity.StaffRole;
import com.aza.backend.entity.User;
import com.aza.backend.repository.StaffRoleRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.util.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Pushes back-office events to the staff who own them (in-app/FCM + email).
 * Controls that fail silently aren't controls: a safeguarding breach or a
 * pending approval should reach someone's inbox, not wait to be noticed.
 * ADMINs receive everything; alerts must never break the flow that raised them.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class StaffAlertService {

    private final StaffRoleRepository staffRoleRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final EmailService emailService;

    public void alertRole(StaffRole.Role role, String subject, String message) {
        try {
            for (UUID userId : recipientsFor(role)) {
                deliver(userId, subject, message);
            }
        } catch (Exception e) {
            log.error("Failed to deliver staff alert '{}': {}", subject, e.getMessage());
        }
    }

    private Set<UUID> recipientsFor(StaffRole.Role role) {
        Set<UUID> recipients = new HashSet<>();
        staffRoleRepository.findByRevokedAtIsNull().forEach(grant -> {
            if (grant.getRole() == role || grant.getRole() == StaffRole.Role.ADMIN) {
                recipients.add(grant.getUserId());
            }
        });
        // Legacy enum admins not yet seeded into staff_roles
        userRepository.findByRole(User.UserRole.ADMIN).forEach(u -> recipients.add(u.getId()));
        return recipients;
    }

    private void deliver(UUID userId, String subject, String message) {
        try {
            notificationService.sendNotification(userId, Notification.NotificationType.SECURITY_ALERT,
                    subject, message, null, null);
        } catch (Exception e) {
            log.warn("Staff alert notification to {} failed: {}", userId, e.getMessage());
        }
        try {
            userRepository.findById(userId).ifPresent(user -> {
                if (user.getEmail() != null) {
                    emailService.sendEmail(user.getEmail(), "[AZA Back Office] " + subject,
                            "<p>" + escapeHtml(message) + "</p><p style=\"color:#888\">— AZA back-office alerts</p>");
                }
            });
        } catch (Exception e) {
            log.warn("Staff alert email to {} failed: {}", userId, e.getMessage());
        }
    }

    private static String escapeHtml(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
