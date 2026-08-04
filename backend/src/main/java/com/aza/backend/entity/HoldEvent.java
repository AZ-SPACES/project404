package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Append-only settlement audit for a hold: who did what, when, under which API key
 * and idempotency key. Rows are never updated or deleted. This is Aza's complete
 * answer to every question it is competent to answer about a hold — payment facts,
 * not merits — and the {@code (hold_id, idempotency_key)} unique constraint is the
 * race-proof idempotency backstop for release and refund.
 */
@Entity
@Table(name = "hold_events", uniqueConstraints =
        @UniqueConstraint(name = "hold_events_hold_idem", columnNames = {"hold_id", "idempotency_key"}))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class HoldEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID holdId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private EventType eventType;

    @Column(precision = 15, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ActorType actorType;

    /** Which of the merchant's keys authorized this. Deliberately not an FK — audit rows survive key rotation. */
    private UUID apiKeyId;

    /** Integrator-supplied free text for their own audit. Aza stores it and never parses it. */
    @Column(length = 500)
    private String reason;

    @Column(length = 255)
    private String idempotencyKey;

    private UUID transactionId;

    @CreationTimestamp
    private LocalDateTime createdAt;

    public enum EventType {
        HELD, RELEASED, REFUNDED, RELEASE_FAILED, FROZEN, UNFROZEN, EXPIRING, EXPIRED_REFUNDED
    }

    public enum ActorType { PLATFORM, ADMIN, SYSTEM }
}
