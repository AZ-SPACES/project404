package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One attempt to charge a {@link PaymentMandate} — including failed attempts, so a merchant's
 * charge history explains itself (ceiling hit, insufficient funds, mandate cancelled) without
 * having to cross-reference logs. The (merchantId, idempotencyKey) constraint is what makes a
 * retried charge call safe to replay instead of double-charging.
 */
@Entity
@Table(name = "mandate_charges", uniqueConstraints =
        @UniqueConstraint(name = "mandate_charges_merchant_idem",
                columnNames = {"merchant_id", "idempotency_key"}))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class MandateCharge {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID mandateId;

    @Column(nullable = false)
    private UUID merchantId;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 255)
    private String idempotencyKey;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status;

    private UUID transactionId;

    @Column(length = 500)
    private String failureReason;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    public enum Status {
        COMPLETED, FAILED
    }
}
