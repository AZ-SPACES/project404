package com.aza.backend.repository;

import com.aza.backend.entity.RiskAlert;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.UUID;

@Repository
public interface RiskAlertRepository extends JpaRepository<RiskAlert, UUID> {
    Page<RiskAlert> findAllByOrderByTriggeredAtDesc(Pageable pageable);
    Page<RiskAlert> findAllBySeverityOrderByTriggeredAtDesc(RiskAlert.Severity severity, Pageable pageable);
    Page<RiskAlert> findAllByStatusOrderByTriggeredAtDesc(RiskAlert.AlertStatus status, Pageable pageable);
    Page<RiskAlert> findAllBySeverityAndStatusOrderByTriggeredAtDesc(RiskAlert.Severity severity, RiskAlert.AlertStatus status, Pageable pageable);
    long countByStatus(RiskAlert.AlertStatus status);
    long countBySeverityAndStatus(RiskAlert.Severity severity, RiskAlert.AlertStatus status);
    long countByResolvedAtAfter(LocalDateTime since);

    @Query("SELECT AVG(r.riskScore) FROM RiskAlert r WHERE r.status != 'FALSE_POSITIVE'")
    Double avgRiskScore();
}
