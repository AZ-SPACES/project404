package com.aza.backend.repository;

import com.aza.backend.entity.ReconBreak;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ReconBreakRepository extends JpaRepository<ReconBreak, UUID> {

    Page<ReconBreak> findByStatusOrderByCreatedAtDesc(ReconBreak.Status status, Pageable pageable);

    Page<ReconBreak> findAllByOrderByCreatedAtDesc(Pageable pageable);

    long countByStatus(ReconBreak.Status status);
}
