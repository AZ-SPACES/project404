package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One attempt to pay a bill.
 *
 * Unlike a transfer, the money leaves Aza entirely, and the thing that finally decides
 * whether it arrived is a system Aza does not control. That shapes the whole record:
 *
 * <ul>
 *   <li>The wallet is debited and committed <em>before</em> the provider is called, so a
 *       payment can never reach a biller without the money having left first.</li>
 *   <li>{@link Status#PENDING} therefore means "debited, outcome unknown" — money that
 *       has left a wallet and reached nobody yet, counted in the safeguarding snapshot
 *       for the same reason held payments are.</li>
 *   <li>A provider that never answers leaves the row PENDING on purpose. It is settled
 *       by asking the provider what happened, never by assuming.</li>
 * </ul>
 */
@Entity
@Table(name = "bill_payments", indexes = {
        @Index(name = "idx_bill_payments_user", columnList = "userId"),
        @Index(name = "idx_bill_payments_status", columnList = "status"),
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class BillPayment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Version
    private Long version;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private UUID billerId;

    /** Meter, phone, policy — whatever this biller identifies an account by. */
    @Column(nullable = false, length = 120)
    private String accountNumber;

    /** Who the biller said that account belongs to, when it can say. */
    @Column(length = 160)
    private String accountName;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 3)
    @Builder.Default
    private String currency = "GHS";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private Status status = Status.PENDING;

    /** The ledger row for the debit, written when the wallet is charged. */
    private UUID transactionId;

    /** The provider's own id for this payment — what a dispute is traced by. */
    @Column(length = 120)
    private String providerReference;

    /**
     * What the biller handed back: a prepaid meter token, a receipt number. The whole
     * point of the payment for a prepaid customer, so it is stored rather than logged.
     */
    @Column(length = 200)
    private String token;

    @Column(length = 500)
    private String failureReason;

    /** Scoped to the user, so replaying a key can never surface someone else's payment. */
    @Column(nullable = false, length = 100)
    private String idempotencyKey;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime completedAt;
    private LocalDateTime refundedAt;

    /** How many times the outcome has been asked for without a definite answer. */
    @Column(nullable = false)
    @Builder.Default
    private int reconcileAttempts = 0;

    public enum Status {
        /** Debited; the provider has not yet given a definite answer. */
        PENDING,
        /** The biller took the money. */
        COMPLETED,
        /** The provider refused it and the money went back to the wallet. */
        REFUNDED,
        /**
         * Definitely failed and definitely not refundable automatically — a provider
         * that took the money but could not deliver. Needs a person.
         */
        FAILED
    }
}
