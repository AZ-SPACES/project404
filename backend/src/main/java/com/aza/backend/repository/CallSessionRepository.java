package com.aza.backend.repository;

import com.aza.backend.entity.CallSession;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface CallSessionRepository extends JpaRepository<CallSession, UUID> {

    @Query("SELECT c FROM CallSession c WHERE c.callerId = :userId OR c.calleeId = :userId " +
           "ORDER BY c.initiatedAt DESC")
    Page<CallSession> findAllByUserId(@Param("userId") UUID userId, Pageable pageable);

    @Query("SELECT c FROM CallSession c WHERE c.calleeId = :userId " +
           "AND c.status = 'MISSED' ORDER BY c.initiatedAt DESC")
    List<CallSession> findMissedCalls(@Param("userId") UUID userId);

    List<CallSession> findByStatusInAndInitiatedAtBefore(
            List<CallSession.CallStatus> statuses, LocalDateTime cutoff);

    @Query("SELECT c FROM CallSession c WHERE (c.callerId = :userId OR c.calleeId = :userId) " +
           "AND c.status IN ('ACTIVE', 'RECONNECTING')")
    java.util.Optional<CallSession> findActiveCallByUserId(@Param("userId") UUID userId);
}
