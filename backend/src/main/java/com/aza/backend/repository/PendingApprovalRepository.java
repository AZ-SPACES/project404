package com.aza.backend.repository;

import com.aza.backend.entity.PendingApproval;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface PendingApprovalRepository extends JpaRepository<PendingApproval, UUID> {

    Page<PendingApproval> findByStatusOrderByRequestedAtDesc(PendingApproval.Status status, Pageable pageable);

    Page<PendingApproval> findAllByOrderByRequestedAtDesc(Pageable pageable);

    long countByStatus(PendingApproval.Status status);

    List<PendingApproval> findByStatusAndRequestedAtBefore(PendingApproval.Status status, LocalDateTime cutoff);
}
