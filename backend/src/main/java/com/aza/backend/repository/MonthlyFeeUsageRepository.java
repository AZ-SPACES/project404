package com.aza.backend.repository;

import com.aza.backend.entity.MonthlyFeeUsage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface MonthlyFeeUsageRepository extends JpaRepository<MonthlyFeeUsage, UUID> {
    Optional<MonthlyFeeUsage> findByUserIdAndTransactionTypeAndUsageMonth(
            UUID userId, String transactionType, String usageMonth);
}
