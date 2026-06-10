package com.aza.backend.service;

import com.aza.backend.entity.AuditLog;
import com.aza.backend.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    /**
     * Records an audit event asynchronously so it never slows down the caller.
     * Failures are logged but not re-thrown — audit must not break the main flow.
     */
    @Async
    public void log(String eventType, String outcome,
                    UUID userId, String userEmail,
                    String ipAddress, String deviceId,
                    UUID resourceId, String resourceType,
                    String details) {
        try {
            auditLogRepository.save(AuditLog.builder()
                    .eventType(eventType)
                    .outcome(outcome)
                    .userId(userId)
                    .userEmail(userEmail)
                    .ipAddress(ipAddress)
                    .deviceId(deviceId)
                    .resourceId(resourceId)
                    .resourceType(resourceType)
                    .details(details)
                    .build());
        } catch (Exception e) {
            log.error("Failed to write audit log [event={}, user={}]: {}", eventType, userId, e.getMessage());
        }
    }

    // ── Convenience overloads ─────────────────────────────────────────────────

    public void log(String eventType, String outcome,
                    UUID userId, String userEmail,
                    String ipAddress) {
        log(eventType, outcome, userId, userEmail, ipAddress, null, null, null, null);
    }

    public void log(String eventType, String outcome,
                    UUID userId, String userEmail,
                    String ipAddress, String deviceId) {
        log(eventType, outcome, userId, userEmail, ipAddress, deviceId, null, null, null);
    }

    public void logWithResource(String eventType, String outcome,
                                UUID userId, String userEmail,
                                String ipAddress,
                                UUID resourceId, String resourceType) {
        log(eventType, outcome, userId, userEmail, ipAddress, null, resourceId, resourceType, null);
    }

    public void logWithDetails(String eventType, String outcome,
                               UUID userId, String userEmail,
                               String ipAddress, String details) {
        log(eventType, outcome, userId, userEmail, ipAddress, null, null, null, details);
    }
}
