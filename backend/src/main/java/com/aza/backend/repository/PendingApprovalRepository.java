package com.aza.backend.repository;

import com.aza.backend.entity.PendingApproval;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PendingApprovalRepository extends JpaRepository<PendingApproval, UUID> {

    /**
     * Pessimistic lock on one approval row. Approving executes a real money action, so two
     * approvers hitting Approve at the same moment must not both get past the PENDING check
     * and run it twice — the second waits here and then sees APPROVED.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM PendingApproval a WHERE a.id = :id")
    Optional<PendingApproval> findByIdForUpdate(@Param("id") UUID id);

    Page<PendingApproval> findByStatusOrderByRequestedAtDesc(PendingApproval.Status status, Pageable pageable);

    Page<PendingApproval> findAllByOrderByRequestedAtDesc(Pageable pageable);

    long countByStatus(PendingApproval.Status status);

    List<PendingApproval> findByStatusAndRequestedAtBefore(PendingApproval.Status status, LocalDateTime cutoff);
}
