package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "risk_alerts")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class RiskAlert {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AlertType alertType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Severity severity;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    private UUID transactionId;

    @Builder.Default
    private Integer riskScore = 0;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private AlertStatus status = AlertStatus.OPEN;

    @Column(columnDefinition = "TEXT")
    private String notes;

    private UUID resolvedBy;
    private LocalDateTime resolvedAt;

    @CreationTimestamp
    private LocalDateTime triggeredAt;

    public enum AlertType {
        VELOCITY, LARGE_TRANSFER, UNUSUAL_PATTERN, MULTIPLE_DEVICES, BLACKLIST_MATCH, PEP_MATCH
    }

    public enum Severity { LOW, MEDIUM, HIGH, CRITICAL }

    public enum AlertStatus { OPEN, INVESTIGATING, RESOLVED, FALSE_POSITIVE }
}
