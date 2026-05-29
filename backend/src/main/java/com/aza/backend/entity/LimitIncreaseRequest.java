package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "limit_increase_requests")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class LimitIncreaseRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal currentDailyLimitGhs;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal currentSingleTransactionLimitGhs;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal requestedDailyLimitGhs;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal requestedSingleTransactionLimitGhs;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Status status = Status.PENDING;

    @Column(columnDefinition = "TEXT")
    private String adminNotes;

    private UUID reviewedBy;

    private LocalDateTime reviewedAt;

    @CreationTimestamp
    private LocalDateTime createdAt;

    public enum Status {
        PENDING, APPROVED, DENIED
    }
}
