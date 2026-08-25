package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One float movement between a super agent and one of its sub-agents. DISTRIBUTE pushes
 * float down the hierarchy; RECALL pulls it back up.
 *
 * <p>Both directions are internal float-wallet-to-float-wallet transfers, so no e-money is
 * minted or burned and the safeguarding invariant is untouched. The movement is strictly
 * no-margin: {@code amount} leaves one float and the same {@code amount} lands in the
 * other. A super agent takes no spread — that is the constraint the whole tier is built
 * around, and {@code SuperAgentService} is the only writer of this table.
 */
@Entity
@Table(name = "float_distributions")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class FloatDistribution {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID superAgentId;

    @Column(nullable = false)
    private UUID subAgentId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private Direction direction;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 3)
    @Builder.Default
    private String currency = "GHS";

    /** The ledger row this movement wrote, for reconciling against transactions. */
    private UUID transactionId;

    @Column(length = 255, unique = true)
    private String idempotencyKey;

    @Column(length = 500)
    private String note;

    /** userId of the master agent operator who executed the movement. */
    private UUID performedBy;

    @CreationTimestamp
    private LocalDateTime createdAt;

    public enum Direction { DISTRIBUTE, RECALL }
}
