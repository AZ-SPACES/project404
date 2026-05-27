package com.aza.backend.repository;

import com.aza.backend.entity.Dispute;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface DisputeRepository extends JpaRepository<Dispute, UUID> {
    Page<Dispute> findAllByOrderByCreatedAtDesc(Pageable pageable);
    Page<Dispute> findAllByStatusOrderByCreatedAtDesc(Dispute.DisputeStatus status, Pageable pageable);
    long countByStatus(Dispute.DisputeStatus status);
    long countByResolvedAtAfter(LocalDateTime since);

    @Query("SELECT COALESCE(SUM(d.amount), 0) FROM Dispute d WHERE d.status IN ('OPEN', 'UNDER_REVIEW')")
    BigDecimal sumActiveDisputeValue();

    @Query("SELECT d FROM Dispute d WHERE d.transactionId IN :transactionIds ORDER BY d.createdAt DESC")
    Page<Dispute> findAllByTransactionIdInOrderByCreatedAtDesc(@Param("transactionIds") List<UUID> transactionIds, Pageable pageable);

    boolean existsByTransactionId(UUID transactionId);
    Page<Dispute> findAllByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);
}
