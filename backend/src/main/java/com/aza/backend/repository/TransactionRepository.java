package com.aza.backend.repository;

import com.aza.backend.entity.Transaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, UUID> {

    /* Find all transactions where user is sender or recipient, ordered by most recent first. */
    @Query("SELECT t FROM Transaction t WHERE t.senderId = :userId OR t.recipientId = :userId ORDER BY t.initiatedAt DESC")
    Page<Transaction> findAllByUserId(@Param("userId") UUID userId, Pageable pageable);

    /* Filter by transaction type */
    @Query("SELECT t FROM Transaction t WHERE (t.senderId = :userId OR t.recipientId = :userId) AND t.type = :type ORDER BY t.initiatedAt DESC")
    Page<Transaction> findAllByUserIdAndType(@Param("userId") UUID userId,
                                             @Param("type") Transaction.TransactionType type,
                                             Pageable pageable);

    /* Filter by status */
    @Query("SELECT t FROM Transaction t WHERE (t.senderId = :userId OR t.recipientId = :userId) AND t.status = :status ORDER BY t.initiatedAt DESC")
    Page<Transaction> findAllByUserIdAndStatus(@Param("userId") UUID userId,
                                               @Param("status") Transaction.TransactionStatus status,
                                               Pageable pageable);

    /* Get total amount sent today for daily limit enforcement.
     * Counts COMPLETED transfers and PENDING transfers that have not yet expired. */
    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t " +
            "WHERE t.senderId = :userId " +
            "AND t.type = 'TRANSFER' " +
            "AND t.initiatedAt >= :startOfDay " +
            "AND t.initiatedAt < :endOfDay " +
            "AND (t.status = 'COMPLETED' OR " +
            "     (t.status = 'PENDING' AND (t.expiresAt IS NULL OR t.expiresAt > :now)))")
    BigDecimal getTotalSentToday(@Param("userId") UUID userId,
                                 @Param("startOfDay") LocalDateTime startofDay,
                                 @Param("endOfDay") LocalDateTime endofDay,
                                 @Param("now") LocalDateTime now);

    Optional<Transaction> findByIdempotencyKey(String idempotencyKey);

}
