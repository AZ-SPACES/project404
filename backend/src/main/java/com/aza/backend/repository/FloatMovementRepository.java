package com.aza.backend.repository;

import com.aza.backend.entity.FloatMovement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface FloatMovementRepository extends JpaRepository<FloatMovement, UUID> {
    Page<FloatMovement> findAllByOrderByCreatedAtDesc(Pageable pageable);
    Page<FloatMovement> findByAgentIdOrderByCreatedAtDesc(UUID agentId, Pageable pageable);
}
