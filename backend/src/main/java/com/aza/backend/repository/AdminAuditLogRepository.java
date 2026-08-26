package com.aza.backend.repository;

import com.aza.backend.entity.AdminAuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface AdminAuditLogRepository extends JpaRepository<AdminAuditLog, UUID> {

    /**
     * Timestamp of the oldest entry, or null when the log is empty.
     *
     * <p>The anchor job used to reach this by loading every audit entry ever written and
     * taking the minimum in Java. The audit log only ever grows, so that would eventually
     * exhaust the heap on the one job whose whole purpose is proving the log intact.
     */
    @Query("SELECT MIN(e.timestamp) FROM AdminAuditLog e")
    java.time.LocalDateTime earliestTimestamp();

    Page<AdminAuditLog> findAllByOrderByTimestampDesc(Pageable pageable);

    Page<AdminAuditLog> findByAdminIdOrderByTimestampDesc(UUID adminId, Pageable pageable);

    List<AdminAuditLog> findByTimestampGreaterThanEqualAndTimestampLessThanOrderByTimestampAscIdAsc(
            LocalDateTime start, LocalDateTime end);
}
