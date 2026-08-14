package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "transactions")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID senderId;

    /**
     * Points at either a {@code users} row or a {@code merchants} row — read it with
     * {@link #recipientType}, never by assuming. Merchant payments have always stored
     * the merchant's id here; anything that joins this straight to users silently gets
     * nothing back for them.
     */
    @Column(nullable = false)
    private UUID recipientId;

    /** Which table {@link #recipientId} points into. */
    @Enumerated(EnumType.STRING)
    @Column(length = 16)
    @Builder.Default
    private RecipientType recipientType = RecipientType.USER;

    /**
     * Which till, branch, or cashier rang up a merchant sale, as carried on the store
     * QR. Null for everything else, and free-form — merchants label their own tills.
     */
    @Column(length = 40)
    private String terminalId;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(length = 500)
    private String note;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private TransactionType type = TransactionType.TRANSFER;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private TransactionStatus status = TransactionStatus.PENDING;

    @Builder.Default
    private Boolean isRequest = false;

    @Column(unique = true)
    private String idempotencyKey;

    private LocalDateTime expiresAt;

    @CreationTimestamp
    private LocalDateTime initiatedAt;

    private LocalDateTime completedAt;
    private LocalDateTime cancelledAt;

    // For money requests
    private LocalDateTime requestedAt;
    private LocalDateTime acceptedAt;
    private LocalDateTime declinedAt;

    /**
     * Set when this request is one person's share of a split bill.
     *
     * A share is an ordinary money request — accepted, declined, and limit-checked
     * through exactly the same path — so splitting a bill never becomes a second way to
     * move money. This only tells the split which of its legs just settled.
     */
    private UUID splitId;

    /** What kind of account {@link #recipientId} names. */
    public enum RecipientType { USER, MERCHANT }

    public enum TransactionType {
        TRANSFER, REQUEST,
        /** Agent cash network: physical cash exchanged for wallet balance. */
        CASH_IN, CASH_OUT,
        /** Reserved for the merchant/biller/disbursement flows built on the same ledger. */
        MERCHANT_PAYMENT, BILL_PAY, PAYOUT, DISBURSEMENT
    }

    public enum TransactionStatus {
        DRAFT, PENDING, COMPLETED, FAILED, CANCELLED, DECLINED, REVERSED,
        /** HIGH-anomaly transfer intercepted at confirmation; COMPLIANCE releases or rejects it. */
        HELD_FOR_REVIEW
    }

    public enum TransactionCategory {
        BILLS, TRANSPORT, FOOD, EDUCATION, ENTERTAINMENT, SHOPPING, HEALTHCARE, SAVINGS, OTHERS
    }

    @Enumerated(EnumType.STRING)
    @Column(nullable = true)
    private TransactionCategory category;

    @Column(nullable = true)
    private Double anomalyScore;

    @Column(length = 10, nullable = true)
    private String anomalyRiskLevel;

    @Column(nullable = true, precision = 15, scale = 2)
    private BigDecimal feeAmount;

    @Column(length = 255)
    private String initiationLocation;
}
