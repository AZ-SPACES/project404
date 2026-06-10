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
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, UUID> {

    java.util.List<Transaction> findAllBySenderIdAndStatus(UUID senderId, Transaction.TransactionStatus status);

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

    @Query("SELECT t FROM Transaction t WHERE (t.senderId = :userId OR t.recipientId = :userId) AND t.status = 'COMPLETED' AND t.initiatedAt >= :start AND t.initiatedAt < :end ORDER BY t.initiatedAt ASC")
    java.util.List<Transaction> findAllByUserIdAndDateRange(@Param("userId") UUID userId,
                                                           @Param("start") LocalDateTime start,
                                                           @Param("end") LocalDateTime end);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t " +
            "WHERE t.senderId = :userId " +
            "AND t.type = 'TRANSFER' " +
            "AND t.status = 'COMPLETED' " +
            "AND t.initiatedAt >= :start " +
            "AND t.initiatedAt < :end")
    BigDecimal getTotalSpentBetween(@Param("userId") UUID userId,
                                    @Param("start") LocalDateTime start,
                                    @Param("end") LocalDateTime end);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t " +
            "WHERE t.senderId = :userId AND t.status = 'COMPLETED' AND t.initiatedAt >= :after")
    BigDecimal getTotalSentAfter(@Param("userId") UUID userId, @Param("after") LocalDateTime after);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t " +
            "WHERE t.recipientId = :userId AND t.status = 'COMPLETED' AND t.initiatedAt >= :after")
    BigDecimal getTotalReceivedAfter(@Param("userId") UUID userId, @Param("after") LocalDateTime after);

    Optional<Transaction> findByIdempotencyKey(String idempotencyKey);

    long countByStatus(Transaction.TransactionStatus status);

    long countByInitiatedAtBetween(java.time.LocalDateTime start, java.time.LocalDateTime end);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t WHERE t.status = 'COMPLETED'")
    java.math.BigDecimal sumCompletedVolume();

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t WHERE t.initiatedAt >= :start AND t.initiatedAt < :end AND t.status = 'COMPLETED'")
    java.math.BigDecimal sumVolumeByInitiatedAtBetween(
            @Param("start") java.time.LocalDateTime start,
            @Param("end") java.time.LocalDateTime end);

    @Query("SELECT t FROM Transaction t ORDER BY t.initiatedAt DESC")
    Page<Transaction> findAllOrderByInitiatedAtDesc(Pageable pageable);

    @Query("SELECT COUNT(t) FROM Transaction t WHERE t.initiatedAt > :since")
    long countByInitiatedAtAfter(@Param("since") java.time.LocalDateTime since);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t WHERE t.recipientId = :userId AND t.type = 'TRANSFER' AND t.status = 'COMPLETED' AND t.initiatedAt >= :start AND t.initiatedAt < :end")
    java.math.BigDecimal getTotalReceivedBetween(@Param("userId") UUID userId,
                                                 @Param("start") LocalDateTime start,
                                                 @Param("end") LocalDateTime end);

    @Query("SELECT COUNT(t) FROM Transaction t WHERE t.recipientId = :userId AND t.status = 'COMPLETED' AND t.initiatedAt >= :start AND t.initiatedAt < :end")
    long countReceivedBetween(@Param("userId") UUID userId,
                               @Param("start") LocalDateTime start,
                               @Param("end") LocalDateTime end);

    /* Filter by direction: INCOMING = user is recipient */
    @Query("SELECT t FROM Transaction t WHERE t.recipientId = :userId ORDER BY t.initiatedAt DESC")
    Page<Transaction> findIncomingByUserId(@Param("userId") UUID userId, Pageable pageable);

    /* Filter by direction: OUTGOING = user is sender */
    @Query("SELECT t FROM Transaction t WHERE t.senderId = :userId ORDER BY t.initiatedAt DESC")
    Page<Transaction> findOutgoingByUserId(@Param("userId") UUID userId, Pageable pageable);

    /* Task 1: Full-text search with optional filters, including direction */
    @Query("SELECT t FROM Transaction t WHERE (t.senderId = :userId OR t.recipientId = :userId) " +
            "AND (:incoming = false OR t.recipientId = :userId) " +
            "AND (:outgoing = false OR t.senderId = :userId) " +
            "AND (:status IS NULL OR t.status = :status) " +
            "AND (:type IS NULL OR t.type = :type) " +
            "AND (:minAmount IS NULL OR t.amount >= :minAmount) " +
            "AND (:maxAmount IS NULL OR t.amount <= :maxAmount) " +
            "AND (:start IS NULL OR t.initiatedAt >= :start) " +
            "AND (:end IS NULL OR t.initiatedAt < :end) " +
            "ORDER BY t.initiatedAt DESC")
    Page<Transaction> searchTransactions(
            @Param("userId") UUID userId,
            @Param("incoming") boolean incoming,
            @Param("outgoing") boolean outgoing,
            @Param("status") Transaction.TransactionStatus status,
            @Param("type") Transaction.TransactionType type,
            @Param("minAmount") BigDecimal minAmount,
            @Param("maxAmount") BigDecimal maxAmount,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end,
            Pageable pageable);

    /* Task 3: Debit-side completed transactions for spending categories */
    @Query("SELECT t FROM Transaction t WHERE t.senderId = :userId AND t.status = 'COMPLETED' AND t.initiatedAt >= :start AND t.initiatedAt < :end ORDER BY t.initiatedAt ASC")
    List<Transaction> findDebitsByUserIdAndDateRange(@Param("userId") UUID userId,
                                                     @Param("start") LocalDateTime start,
                                                     @Param("end") LocalDateTime end);

    @Query("SELECT COUNT(t) FROM Transaction t WHERE (t.senderId = :userId OR t.recipientId = :userId) AND t.status = 'COMPLETED' AND t.initiatedAt >= :start AND t.initiatedAt < :end")
    long countCompletedTransactionsForUser(@Param("userId") UUID userId,
                                           @Param("start") LocalDateTime start,
                                           @Param("end") LocalDateTime end);

    // ── Anomaly detection queries ─────────────────────────────────────────────

    @Query("SELECT COUNT(t) FROM Transaction t WHERE t.senderId = :userId AND t.recipientId = :recipientId AND t.status = 'COMPLETED'")
    long countCompletedDebitsByUserAndRecipient(@Param("userId") UUID userId, @Param("recipientId") UUID recipientId);

    @Query("SELECT COUNT(t) FROM Transaction t WHERE t.senderId = :userId AND t.status = 'COMPLETED' AND t.type = 'TRANSFER' AND t.initiatedAt >= :since")
    long countCompletedDebitsByUser(@Param("userId") UUID userId, @Param("since") LocalDateTime since);

    @Query("SELECT COALESCE(AVG(t.amount), 0) FROM Transaction t WHERE t.senderId = :userId AND t.status = 'COMPLETED' AND t.type = 'TRANSFER' AND t.initiatedAt >= :since")
    BigDecimal getAverageAmountByUser(@Param("userId") UUID userId, @Param("since") LocalDateTime since);

    @Query("SELECT COALESCE(MAX(t.amount), 0) FROM Transaction t WHERE t.senderId = :userId AND t.status = 'COMPLETED' AND t.type = 'TRANSFER' AND t.initiatedAt >= :since")
    BigDecimal getMaxAmountByUser(@Param("userId") UUID userId, @Param("since") LocalDateTime since);

    // ── Category suggestion queries ───────────────────────────────────────────

    @Query("SELECT t FROM Transaction t WHERE t.senderId = :userId AND t.recipientId = :recipientId AND t.status = 'COMPLETED' ORDER BY t.completedAt DESC")
    List<Transaction> findCompletedDebitsByUserAndRecipient(@Param("userId") UUID userId, @Param("recipientId") UUID recipientId, org.springframework.data.domain.Pageable pageable);

    /* Task 4: Active users for cohort retention */
    @Query("SELECT DISTINCT t.senderId FROM Transaction t WHERE t.senderId IN :userIds AND t.initiatedAt >= :start AND t.initiatedAt < :end AND t.status = 'COMPLETED'")
    List<UUID> findActiveUserIds(@Param("userIds") List<UUID> userIds,
                                  @Param("start") LocalDateTime start,
                                  @Param("end") LocalDateTime end);

    /* Task 5: Count distinct active senders for revenue dashboard */
    @Query("SELECT COUNT(DISTINCT t.senderId) FROM Transaction t WHERE t.status = 'COMPLETED' AND t.initiatedAt >= :start AND t.initiatedAt < :end")
    long countActiveUsersBetween(@Param("start") LocalDateTime start,
                                  @Param("end") LocalDateTime end);

    // ── Admin AI: Fraud + Category Analytics ──────────────────────────────────

    @Query("SELECT t FROM Transaction t WHERE t.anomalyRiskLevel = :riskLevel ORDER BY t.initiatedAt DESC")
    Page<Transaction> findByAnomalyRiskLevel(@Param("riskLevel") String riskLevel, Pageable pageable);

    @Query("SELECT t FROM Transaction t WHERE t.anomalyRiskLevel IN ('MEDIUM', 'HIGH') ORDER BY t.initiatedAt DESC")
    Page<Transaction> findFlaggedTransactions(Pageable pageable);

    @Query("SELECT t.category, COUNT(t), SUM(t.amount) FROM Transaction t WHERE t.status = 'COMPLETED' AND t.category IS NOT NULL AND t.initiatedAt >= :since GROUP BY t.category ORDER BY SUM(t.amount) DESC")
    List<Object[]> getCategoryBreakdown(@Param("since") LocalDateTime since);
}
