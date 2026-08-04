package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A user's standing authorization for a merchant to debit their wallet on demand, without a
 * passcode at charge time. Consent is captured once (mini-app consent sheet or the OAuth /
 * aza-pay hosted approval page) and enforced here after that: every charge is capped by
 * {@code perChargeLimit} and, if set, a rolling {@code periodLimit} window. The passcode is only
 * ever required once, at {@link #approvedAt} — the same trade-off already accepted by
 * RecurringTransferService for standing transfers.
 */
@Entity
@Table(name = "payment_mandates")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class PaymentMandate {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID merchantId;

    @Column(nullable = false)
    private UUID payerUserId;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal perChargeLimit;

    /** Null = no period cap; only perChargeLimit is enforced on each charge. */
    @Column(precision = 18, scale = 2)
    private BigDecimal periodLimit;

    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    private PeriodType periodType;

    /** Amount charged within the current period window. Reset lazily in PaymentMandateService. */
    @Column(nullable = false, precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal periodSpent = BigDecimal.ZERO;

    private LocalDateTime periodResetAt;

    /** Optional hard end date. Null = open-ended (e.g. an ongoing subscription). */
    private LocalDateTime expiresAt;

    @Column(nullable = false, length = 255)
    private String reference;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.PENDING_APPROVAL;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private SourceType sourceType;

    /** Mini-app id or OAuth client id, depending on sourceType — shown to the user as "via X". */
    @Column(nullable = false, length = 100)
    private String sourceId;

    private LocalDateTime lastChargedAt;
    private LocalDateTime approvedAt;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    public enum PeriodType {
        DAILY, WEEKLY, MONTHLY
    }

    public enum Status {
        PENDING_APPROVAL, ACTIVE, PAUSED, CANCELLED, EXPIRED
    }

    public enum SourceType {
        MINI_APP, OAUTH
    }
}
