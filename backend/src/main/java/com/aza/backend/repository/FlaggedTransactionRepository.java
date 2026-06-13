package com.aza.backend.repository;

import com.aza.backend.entity.FlaggedTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.UUID;

@Repository
public interface FlaggedTransactionRepository extends JpaRepository<FlaggedTransaction, UUID> {
    Page<FlaggedTransaction> findAllByOrderByFlaggedAtDesc(Pageable pageable);
    Page<FlaggedTransaction> findAllByStatusOrderByFlaggedAtDesc(FlaggedTransaction.FlagStatus status, Pageable pageable);
    long countByStatus(FlaggedTransaction.FlagStatus status);
    long countByFlaggedAtAfter(LocalDateTime since);
    long countByRiskScoreGreaterThanEqual(int score);

    long countByFlaggedAtBetween(LocalDateTime start, LocalDateTime end);

    long countByStatusAndReviewedAtBetween(FlaggedTransaction.FlagStatus status, LocalDateTime start, LocalDateTime end);

    @Query("SELECT AVG(f.riskScore) FROM FlaggedTransaction f")
    Double avgRiskScore();

    java.util.List<FlaggedTransaction> findAllByOrderByFlaggedAtDesc();

    java.util.List<FlaggedTransaction> findAllByStatusOrderByFlaggedAtDesc(FlaggedTransaction.FlagStatus status);

    @org.springframework.data.jpa.repository.Query("SELECT f FROM FlaggedTransaction f WHERE " +
           "(:status IS NULL OR f.status = :status) " +
           "AND (:from IS NULL OR f.flaggedAt >= :from) " +
           "AND (:to IS NULL OR f.flaggedAt <= :to) " +
           "ORDER BY f.flaggedAt DESC")
    java.util.List<FlaggedTransaction> exportSearch(
            @org.springframework.data.repository.query.Param("status") FlaggedTransaction.FlagStatus status,
            @org.springframework.data.repository.query.Param("from") LocalDateTime from,
            @org.springframework.data.repository.query.Param("to") LocalDateTime to);
}
