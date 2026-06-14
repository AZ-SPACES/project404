package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A user authorised to exchange physical cash for wallet balance. The agent's
 * float is their primary {@link Wallet}, so cash-in/out is an internal
 * wallet-to-wallet transfer. {@code commissionAccruedGhs} tracks what AZA owes
 * the agent for cash-in commission (a payable settled out of band — it is not
 * minted as e-money, which keeps the safeguarding invariant intact).
 */
@Entity
@Table(name = "agents")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Agent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private UUID userId;

    /** Short till/agent code customers or back office can reference. */
    @Column(unique = true, length = 20)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Tier tier = Tier.STANDARD;

    @Column(length = 255)
    private String location;

    /** Optional cap on how much float the agent may hold. */
    @Column(precision = 15, scale = 2)
    private BigDecimal floatLimit;

    /** Cash-in commission AZA pays the agent, in basis points of the deposit (default 0.20%). */
    @Column(nullable = false)
    @Builder.Default
    private Integer cashInCommissionBps = 20;

    /** Agent's share of the cash-out fee, in basis points (default 50%). */
    @Column(nullable = false)
    @Builder.Default
    private Integer cashOutCommissionShareBps = 5000;

    /** Running commission payable owed to the agent (not e-money). */
    @Column(nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal commissionAccruedGhs = BigDecimal.ZERO;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public enum Status { PENDING, ACTIVE, SUSPENDED, REJECTED }
    public enum Tier { STANDARD, SUPER }
}
