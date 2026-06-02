package com.aza.backend.repository;

import com.aza.backend.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    Page<AuditLog> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    Page<AuditLog> findByEventTypeOrderByCreatedAtDesc(String eventType, Pageable pageable);

    List<AuditLog> findByUserIdAndCreatedAtBetweenOrderByCreatedAtDesc(
            UUID userId, LocalDateTime from, LocalDateTime to);
}
