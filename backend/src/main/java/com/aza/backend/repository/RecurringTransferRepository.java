package com.aza.backend.repository;

import com.aza.backend.entity.RecurringTransfer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface RecurringTransferRepository extends JpaRepository<RecurringTransfer, UUID> {

    List<RecurringTransfer> findAllByUserIdOrderByCreatedAtDesc(UUID userId);

    List<RecurringTransfer> findAllByStatusAndNextRunAtBefore(
            RecurringTransfer.Status status, LocalDateTime cutoff);
}
