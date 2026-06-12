package com.aza.backend.repository;

import com.aza.backend.entity.RiskDecisionLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface RiskDecisionLogRepository extends JpaRepository<RiskDecisionLog, UUID> {

    Optional<RiskDecisionLog> findByTransactionId(UUID transactionId);
}
