package com.aza.backend.repository;

import com.aza.backend.entity.HistoryTransfer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface HistoryTransferRepository extends JpaRepository<HistoryTransfer, UUID> {

    Optional<HistoryTransfer> findByIdAndUserId(UUID id, UUID userId);

    List<HistoryTransfer> findByUserIdAndStatusAndExpiresAtAfter(
            UUID userId, HistoryTransfer.Status status, LocalDateTime now);

    List<HistoryTransfer> findByUserIdAndRequestingDeviceIdAndStatusIn(
            UUID userId, String requestingDeviceId, List<HistoryTransfer.Status> statuses);

    @Modifying
    @Query("DELETE FROM HistoryTransfer t WHERE t.expiresAt < :cutoff")
    int deleteExpired(LocalDateTime cutoff);
}
