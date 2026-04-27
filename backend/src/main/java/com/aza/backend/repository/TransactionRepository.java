package com.aza.backend.repository;

import com.aza.backend.entity.Transaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, UUID> {

    /**
     * Find all transactions where user is sender or recipient,
     * ordered by most recent first.
     */
    @Query("SELECT t FROM Transaction t WHERE t.senderId = :userId OR t.recipientId = :userId ORDER BY t.initiatedAt DESC")
    Page<Transaction> findAllByUserId(UUID userId, Pageable pageable);

    /**
     * Filter by transaction type
     */
    @Query("SELECT t FROM Transaction t WHERE (t.senderId = :userId OR t.recipientId = :userId) AND t.type = :type ORDER BY t.initiatedAt DESC")
    Page<Transaction> findAllByUserIdAndType(UUID userId, Transaction.TransactionType type, Pageable pageable);

    /**
     * Filter by status
     */
    @Query("SELECT t FROM Transaction t WHERE (t.senderId = :userId OR t.recipientId = :userId) AND t.status = :status ORDER BY t.initiatedAt DESC")
    Page<Transaction> findAllByUserIdAndStatus(UUID userId, Transaction.TransactionStatus status, Pageable pageable);
}
