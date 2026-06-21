package com.aza.backend.repository;

import com.aza.backend.entity.AgentCommissionSettlement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface AgentCommissionSettlementRepository extends JpaRepository<AgentCommissionSettlement, UUID> {
    Page<AgentCommissionSettlement> findAllByOrderByCreatedAtDesc(Pageable pageable);
    Page<AgentCommissionSettlement> findByAgentIdOrderByCreatedAtDesc(UUID agentId, Pageable pageable);
}
