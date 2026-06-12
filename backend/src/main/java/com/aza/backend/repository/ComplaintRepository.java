package com.aza.backend.repository;

import com.aza.backend.entity.Complaint;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.UUID;

@Repository
public interface ComplaintRepository extends JpaRepository<Complaint, UUID> {

    Page<Complaint> findByStatusOrderByCreatedAtDesc(Complaint.Status status, Pageable pageable);

    Page<Complaint> findAllByOrderByCreatedAtDesc(Pageable pageable);

    long countByStatus(Complaint.Status status);

    long countByCreatedAtBetween(LocalDateTime start, LocalDateTime end);

    long countByResolvedAtBetween(LocalDateTime start, LocalDateTime end);
}
