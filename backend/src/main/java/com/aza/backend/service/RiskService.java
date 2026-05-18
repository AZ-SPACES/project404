package com.aza.backend.service;

import com.aza.backend.dto.admin.RiskAlertResponse;
import com.aza.backend.dto.admin.RiskStatsResponse;
import com.aza.backend.entity.RiskAlert;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.RiskAlertRepository;
import com.aza.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RiskService {

    private final RiskAlertRepository riskAlertRepository;
    private final UserRepository userRepository;

    public Page<RiskAlertResponse> getAlerts(int page, int size, String severity, String status) {
        PageRequest pageable = PageRequest.of(page, size);
        Page<RiskAlert> items;

        if (severity != null && !severity.isBlank() && status != null && !status.isBlank()) {
            items = riskAlertRepository.findAllBySeverityAndStatusOrderByTriggeredAtDesc(
                    RiskAlert.Severity.valueOf(severity.toUpperCase()),
                    RiskAlert.AlertStatus.valueOf(status.toUpperCase()),
                    pageable);
        } else if (severity != null && !severity.isBlank()) {
            items = riskAlertRepository.findAllBySeverityOrderByTriggeredAtDesc(
                    RiskAlert.Severity.valueOf(severity.toUpperCase()), pageable);
        } else if (status != null && !status.isBlank()) {
            items = riskAlertRepository.findAllByStatusOrderByTriggeredAtDesc(
                    RiskAlert.AlertStatus.valueOf(status.toUpperCase()), pageable);
        } else {
            items = riskAlertRepository.findAllByOrderByTriggeredAtDesc(pageable);
        }

        return items.map(this::toResponse);
    }

    public RiskStatsResponse getStats() {
        long open = riskAlertRepository.countByStatus(RiskAlert.AlertStatus.OPEN);
        long critical = riskAlertRepository.countBySeverityAndStatus(RiskAlert.Severity.CRITICAL, RiskAlert.AlertStatus.OPEN);
        long investigating = riskAlertRepository.countByStatus(RiskAlert.AlertStatus.INVESTIGATING);
        long resolvedToday = riskAlertRepository.countByResolvedAtAfter(LocalDate.now().atStartOfDay());
        Double avgScore = riskAlertRepository.avgRiskScore();

        return RiskStatsResponse.builder()
                .openAlerts(open)
                .criticalAlerts(critical)
                .investigatingAlerts(investigating)
                .resolvedToday(resolvedToday)
                .averageRiskScore(avgScore != null ? Math.round(avgScore * 10.0) / 10.0 : 0.0)
                .build();
    }

    @Transactional
    public RiskAlertResponse updateAlert(UUID id, String newStatus, String notes, User admin) {
        RiskAlert alert = riskAlertRepository.findById(id)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Risk alert not found", HttpStatus.NOT_FOUND));

        RiskAlert.AlertStatus alertStatus = RiskAlert.AlertStatus.valueOf(newStatus.toUpperCase());
        alert.setStatus(alertStatus);
        if (notes != null && !notes.isBlank()) {
            alert.setNotes(notes);
        }
        if (alertStatus == RiskAlert.AlertStatus.RESOLVED || alertStatus == RiskAlert.AlertStatus.FALSE_POSITIVE) {
            alert.setResolvedBy(admin.getId());
            alert.setResolvedAt(LocalDateTime.now());
        }
        riskAlertRepository.save(alert);
        return toResponse(alert);
    }

    private RiskAlertResponse toResponse(RiskAlert alert) {
        User user = userRepository.findById(alert.getUserId()).orElse(null);
        return RiskAlertResponse.builder()
                .id(alert.getId().toString())
                .userId(alert.getUserId().toString())
                .userName(user != null ? user.getFirstName() + " " + user.getLastName() : "Unknown")
                .userHandle(user != null ? user.getUsername() : null)
                .alertType(alert.getAlertType().name())
                .severity(alert.getSeverity().name())
                .description(alert.getDescription())
                .transactionId(alert.getTransactionId() != null ? alert.getTransactionId().toString() : null)
                .riskScore(alert.getRiskScore())
                .triggeredAt(alert.getTriggeredAt())
                .status(alert.getStatus().name())
                .notes(alert.getNotes())
                .build();
    }
}
