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

    @Query("SELECT AVG(f.riskScore) FROM FlaggedTransaction f")
    Double avgRiskScore();
}
