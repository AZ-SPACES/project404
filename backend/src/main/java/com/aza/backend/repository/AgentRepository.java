package com.aza.backend.repository;

import com.aza.backend.entity.Agent;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AgentRepository extends JpaRepository<Agent, UUID> {
    Optional<Agent> findByUserId(UUID userId);
    Optional<Agent> findByCode(String code);
    Page<Agent> findAllByOrderByCreatedAtDesc(Pageable pageable);
    Page<Agent> findByStatusOrderByCreatedAtDesc(Agent.Status status, Pageable pageable);

    /** Total cash-in commission AZA still owes agents (a payable, not e-money). */
    @Query("SELECT COALESCE(SUM(a.commissionAccruedGhs), 0) FROM Agent a")
    BigDecimal sumCommissionAccrued();

    // ── Super-agent hierarchy ───────────────────────────────────────────────────
    // Every one of these is scoped by parentAgentId, which is what keeps a master
    // agent's reads confined to their own downline.

    List<Agent> findByParentAgentIdOrderByCreatedAtDesc(UUID parentAgentId);

    Page<Agent> findByParentAgentIdOrderByCreatedAtDesc(UUID parentAgentId, Pageable pageable);

    Page<Agent> findByParentAgentIdAndStatusOrderByCreatedAtDesc(
            UUID parentAgentId, Agent.Status status, Pageable pageable);

    long countByParentAgentId(UUID parentAgentId);

    long countByParentAgentIdAndStatus(UUID parentAgentId, Agent.Status status);

    /** Commission AZA owes the agents under one master — reporting only; never paid by the master. */
    @Query("SELECT COALESCE(SUM(a.commissionAccruedGhs), 0) FROM Agent a WHERE a.parentAgentId = :parentAgentId")
    BigDecimal sumDownlineCommissionAccrued(@Param("parentAgentId") UUID parentAgentId);
}
