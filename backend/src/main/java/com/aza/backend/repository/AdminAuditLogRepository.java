package com.aza.backend.repository;

import com.aza.backend.entity.AdminAuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface AdminAuditLogRepository extends JpaRepository<AdminAuditLog, UUID> {

    Page<AdminAuditLog> findAllByOrderByTimestampDesc(Pageable pageable);

    Page<AdminAuditLog> findByAdminIdOrderByTimestampDesc(UUID adminId, Pageable pageable);

    List<AdminAuditLog> findByTimestampGreaterThanEqualAndTimestampLessThanOrderByTimestampAscIdAsc(
            LocalDateTime start, LocalDateTime end);
}
