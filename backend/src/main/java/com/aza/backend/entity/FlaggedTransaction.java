package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "flagged_transactions")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class FlaggedTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID transactionId;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 10)
    @Builder.Default
    private String currency = "GHS";

    @Column(nullable = false, columnDefinition = "TEXT")
    private String flagReason;

    @Column(nullable = false)
    @Builder.Default
    private Integer riskScore = 0;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private FlagStatus status = FlagStatus.PENDING_REVIEW;

    @CreationTimestamp
    private LocalDateTime flaggedAt;

    private LocalDateTime reviewedAt;
    private UUID reviewedBy;

    @Column(columnDefinition = "TEXT")
    private String notes;

    public enum FlagStatus { PENDING_REVIEW, CLEARED, REPORTED }
}
