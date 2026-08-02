package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Money debited from a payer at checkout confirmation but not yet settled to anyone.
 * Owned by nobody: the payer committed it, the recipients have not earned it — which
 * is why it is a ledger row and not a wallet. The integrator resolves it by calling
 * release or refund; Phase 2 adds expiry auto-refund and the FROZEN compliance path.
 *
 * Counted explicitly in the safeguarding snapshot (held_float): this money is in no
 * wallet sum and no merchant balance, so omitting it would fake a surplus.
 */
@Entity
@Table(name = "payment_holds")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class PaymentHold {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private UUID sessionId;

    @Column(nullable = false)
    private UUID merchantId;

    @Column(nullable = false)
    private UUID payerUserId;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal releasedAmount = BigDecimal.ZERO;

    @Column(nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal refundedAmount = BigDecimal.ZERO;

    /** Quoted at capture against the merchant's feeRateBps; deducted at release, returned in full on refund. */
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal azaFee;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    @Builder.Default
    private HoldStatus status = HoldStatus.HELD;

    /** Set only by Aza compliance (Phase 2). While present, both release and refund are blocked. */
    @Column(length = 500)
    private String frozenReason;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "test_mode", nullable = false)
    @Builder.Default
    private Boolean testMode = false;

    @CreationTimestamp
    private LocalDateTime heldAt;

    private LocalDateTime resolvedAt;

    public enum HoldStatus {
        HELD, RELEASED, REFUNDED, PARTIALLY_SETTLED, FROZEN
    }

    public boolean isActive() {
        return status == HoldStatus.HELD || status == HoldStatus.FROZEN;
    }
}
