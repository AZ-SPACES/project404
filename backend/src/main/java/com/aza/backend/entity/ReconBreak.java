package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A reconciliation break: a line on an external rail statement that could not
 * be matched to an internal transaction (or matched with a different amount).
 * Lives in a queue until a FINANCE staff member resolves it with notes.
 */
@Entity
@Table(name = "recon_breaks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReconBreak {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Label of the statement import this break came from (e.g. "MTN MoMo 2026-06-10"). */
    @Column(nullable = false)
    private String importLabel;

    @Column(nullable = false)
    private String statementReference;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal statementAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Direction direction;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false, length = 20)
    private BreakReason reason = BreakReason.NO_MATCH;

    /** Internal transaction amount when a reference matched but amounts differ. */
    @Column(precision = 18, scale = 2)
    private BigDecimal internalAmount;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false, length = 20)
    private Status status = Status.OPEN;

    @Column(length = 1000)
    private String resolutionNotes;

    private UUID resolvedBy;
    private LocalDateTime resolvedAt;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public enum Direction { CREDIT, DEBIT }

    public enum BreakReason {
        NO_MATCH,        // statement line has no matching internal transaction
        AMOUNT_MISMATCH  // reference matched but amounts differ
    }

    public enum Status { OPEN, RESOLVED }
}
