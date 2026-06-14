package com.aza.backend.repository;

import com.aza.backend.entity.Agent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface AgentRepository extends JpaRepository<Agent, UUID> {
    Optional<Agent> findByUserId(UUID userId);
    Optional<Agent> findByCode(String code);
    Page<Agent> findAllByOrderByCreatedAtDesc(Pageable pageable);
    Page<Agent> findByStatusOrderByCreatedAtDesc(Agent.Status status, Pageable pageable);
}
