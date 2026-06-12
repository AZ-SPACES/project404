package com.aza.backend.service;

import com.aza.backend.dto.admin.AdminAuditLogEntry;
import com.aza.backend.entity.AdminAuditLog;
import com.aza.backend.entity.User;
import com.aza.backend.repository.AdminAuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AdminAuditService {

    private final AdminAuditLogRepository repo;

    public void log(User admin, String action, User target, String details) {
        repo.save(AdminAuditLog.builder()
                .adminId(admin.getId())
                .adminEmail(admin.getEmail())
                .adminName(admin.getFirstName() + " " + admin.getLastName())
                .action(action)
                .targetUserId(target != null ? target.getId() : null)
                .targetUserEmail(target != null ? target.getEmail() : null)
                .details(details)
                .build());
    }

    public Page<AdminAuditLogEntry> getLogs(int page, int size, java.util.UUID adminId) {
        PageRequest pageable = PageRequest.of(page, size);
        Page<AdminAuditLog> logs = adminId != null
                ? repo.findByAdminIdOrderByTimestampDesc(adminId, pageable)
                : repo.findAllByOrderByTimestampDesc(pageable);
        return logs.map(this::toEntry);
    }

    private AdminAuditLogEntry toEntry(AdminAuditLog log) {
        return AdminAuditLogEntry.builder()
                .id(log.getId().toString())
                .adminId(log.getAdminId() != null ? log.getAdminId().toString() : null)
                .adminEmail(log.getAdminEmail())
                .adminName(log.getAdminName())
                .action(log.getAction())
                .targetUserId(log.getTargetUserId() != null ? log.getTargetUserId().toString() : null)
                .targetUserEmail(log.getTargetUserEmail())
                .details(log.getDetails())
                .timestamp(log.getTimestamp() != null ? log.getTimestamp().toString() : null)
                .build();
    }
}
