package com.aza.backend.repository;

import com.aza.backend.entity.Budget;
import com.aza.backend.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BudgetRepository extends JpaRepository<Budget, UUID> {
    List<Budget> findByUserId(UUID userId);
    Optional<Budget> findByUserIdAndCategory(UUID userId, Transaction.TransactionCategory category);
    boolean existsByUserIdAndCategory(UUID userId, Transaction.TransactionCategory category);
}
