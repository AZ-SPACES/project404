package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "recurring_transfers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RecurringTransfer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String recipientIdentifier;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal amount;

    @Column
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Frequency frequency;

    @Column(nullable = false)
    private LocalDateTime nextRunAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Status status = Status.ACTIVE;

    @Column(nullable = false)
    @Builder.Default
    private int totalRuns = 0;

    @Column(nullable = false)
    @Builder.Default
    private int successfulRuns = 0;

    @Column
    private LocalDateTime lastRunAt;

    @Column
    private String lastFailureReason;

    /* Nullable; set once at creation for idempotency (Task 6) */
    @Column(unique = true)
    private String idempotencyKey;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    public enum Frequency {
        DAILY, WEEKLY, MONTHLY
    }

    public enum Status {
        ACTIVE, PAUSED, CANCELLED
    }
}
