package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A customer-generated, one-time code authorising an agent to release {@code amount}
 * in cash. Only the SHA-256 hash of the code is stored. Redemption is the proof of
 * payment, so an agent can never pull from a customer wallet directly.
 */
@Entity
@Table(name = "withdrawal_codes")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class WithdrawalCode {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, unique = true, length = 64)
    private String codeHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.ACTIVE;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    /** userId of the agent who redeemed the code. */
    private UUID redeemedByAgentId;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime redeemedAt;

    public enum Status { ACTIVE, REDEEMED, EXPIRED, CANCELLED }
}
