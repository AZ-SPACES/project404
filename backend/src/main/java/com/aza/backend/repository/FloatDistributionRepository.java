package com.aza.backend.repository;

import com.aza.backend.entity.FloatDistribution;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface FloatDistributionRepository extends JpaRepository<FloatDistribution, UUID> {

    Optional<FloatDistribution> findByIdempotencyKey(String idempotencyKey);

    Page<FloatDistribution> findBySuperAgentIdOrderByCreatedAtDesc(UUID superAgentId, Pageable pageable);

    Page<FloatDistribution> findBySuperAgentIdAndSubAgentIdOrderByCreatedAtDesc(
            UUID superAgentId, UUID subAgentId, Pageable pageable);

    Page<FloatDistribution> findBySuperAgentIdAndDirectionOrderByCreatedAtDesc(
            UUID superAgentId, FloatDistribution.Direction direction, Pageable pageable);

    /** Volume moved in one direction since a cutoff — the dashboard's today/7d/30d tiles. */
    @Query("""
            SELECT COALESCE(SUM(d.amount), 0) FROM FloatDistribution d
            WHERE d.superAgentId = :superAgentId
              AND d.direction = :direction
              AND d.createdAt >= :since
            """)
    BigDecimal sumSince(@Param("superAgentId") UUID superAgentId,
                        @Param("direction") FloatDistribution.Direction direction,
                        @Param("since") LocalDateTime since);

    /**
     * Lifetime net float pushed to each sub-agent (distributed minus recalled), for the
     * reconciliation view. Returns {@code [subAgentId, net]} rows.
     *
     * <p>{@code positiveDirection} is passed in rather than written as an enum literal:
     * a JPQL literal for a <em>nested</em> enum is not portable, and binding it keeps the
     * query readable and Hibernate-version-proof. Callers pass {@code DISTRIBUTE}.
     */
    @Query("""
            SELECT d.subAgentId,
                   COALESCE(SUM(CASE WHEN d.direction = :positiveDirection
                                     THEN d.amount ELSE -d.amount END), 0)
            FROM FloatDistribution d
            WHERE d.superAgentId = :superAgentId
            GROUP BY d.subAgentId
            """)
    List<Object[]> netPerSubAgent(@Param("superAgentId") UUID superAgentId,
                                  @Param("positiveDirection") FloatDistribution.Direction positiveDirection);
}
