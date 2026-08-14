package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Akyede — money given to one person as a gift.
 *
 * The sender is debited in full when the gift is sent, and the money sits here until the
 * recipient opens it or the clock runs out. An unopened gift is therefore customer money
 * which has left a wallet and reached none, exactly like a {@link PaymentHold}: it is
 * counted in the safeguarding snapshot, and against the sender's daily limit, for the
 * same reasons given there.
 *
 * A gift is addressed, not offered to a crowd. {@link #recipientId} is the only account
 * that may open it; {@link #claimCode} is how the recipient reaches it — a deep link into
 * the app — and never a licence for whoever holds the code to take the money.
 *
 * {@link #chatId} is set only when the gift was sent inside an Aza thread, and is used
 * for rendering it there, never for deciding who may open it.
 */
@Entity
@Table(name = "red_envelopes", indexes = {
        @Index(name = "idx_red_envelopes_sender", columnList = "senderId"),
        @Index(name = "idx_red_envelopes_recipient", columnList = "recipientId"),
        @Index(name = "idx_red_envelopes_status_expires", columnList = "status,expiresAt"),
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class RedEnvelope {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /**
     * Guards the open. The open path also takes a row lock, but this stops a lost update
     * if any other path ever writes the gift.
     */
    @Version
    private Long version;

    /** How the recipient reaches the gift — what the deep link carries. */
    @Column(nullable = false, unique = true, length = 22)
    private String claimCode;

    @Column(nullable = false)
    private UUID senderId;

    /** The one account this gift is for. Nobody else may open it. */
    @Column(nullable = false)
    private UUID recipientId;

    /** Set when the gift was sent inside an Aza chat; null when sent from elsewhere. */
    private UUID chatId;

    private UUID messageId;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 3)
    @Builder.Default
    private String currency = "GHS";

    /** Returned to the sender when the gift expired unopened. */
    @Column(precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal refundedAmount = BigDecimal.ZERO;

    /** What the gift is for. Chooses the wrapping the recipient sees. */
    @Enumerated(EnumType.STRING)
    @Column(length = 24)
    private Occasion occasion;

    /** The note shown when it is opened. */
    @Column(length = 140)
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.UNOPENED;

    /** The credit written to the recipient's history, so the gift shows in a statement. */
    private UUID transactionId;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime openedAt;
    private LocalDateTime settledAt;

    /** The celebration a gift was sent for. Presentation only — it moves no money. */
    public enum Occasion {
        BIRTHDAY,
        WEDDING,
        OUTDOORING,
        GRADUATION,
        CONGRATULATIONS,
        THANK_YOU,
        CHRISTMAS,
        EID,
        EASTER,
        JUST_BECAUSE
    }

    public enum Status {
        /** Sent and waiting. The money is out of the sender's wallet and in none. */
        UNOPENED,
        /** The recipient opened it and was credited. */
        OPENED,
        /** Expired unopened; the money went back to the sender. */
        EXPIRED_REFUNDED
    }

    /** Money still owed out of this gift — neither given to the recipient nor returned. */
    public BigDecimal outstandingAmount() {
        if (status != Status.UNOPENED) return BigDecimal.ZERO;
        return amount.subtract(refundedAmount == null ? BigDecimal.ZERO : refundedAmount);
    }
}
