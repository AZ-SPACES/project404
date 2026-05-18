package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "disputes")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Dispute {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 20)
    private String referenceId;

    @Column(nullable = false)
    private UUID transactionId;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 10)
    @Builder.Default
    private String currency = "GHS";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DisputeCategory category;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "TEXT")
    private String evidence;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private DisputeStatus status = DisputeStatus.OPEN;

    @Column(columnDefinition = "TEXT")
    private String resolution;

    private UUID resolvedBy;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime resolvedAt;

    public enum DisputeCategory {
        UNAUTHORIZED, WRONG_AMOUNT, NOT_RECEIVED, DUPLICATE, SERVICE_ISSUE, OTHER
    }

    public enum DisputeStatus {
        OPEN, UNDER_REVIEW, RESOLVED_APPROVED, RESOLVED_DENIED
    }
}
