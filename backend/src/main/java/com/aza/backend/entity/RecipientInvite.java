package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A merchant's standing intent to pay someone who is not on Aza yet.
 *
 * Carries no money and grants no authority — it exists so the merchant learns when the
 * person becomes payable, instead of discovering it by a failed hold creation. Fulfilled
 * automatically when someone signs up with the invited identifier.
 */
@Entity
@Table(name = "recipient_invites", uniqueConstraints =
        @UniqueConstraint(name = "recipient_invites_merchant_identifier",
                columnNames = {"merchant_id", "identifier"}))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class RecipientInvite {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID merchantId;

    /** Normalized at write time so lookup at signup matches whatever shape was invited. */
    @Column(nullable = false, length = 255)
    private String identifier;

    @Column(length = 255)
    private String displayName;

    /** The merchant's own id for this person, echoed back on fulfilment. */
    @Column(length = 255)
    private String reference;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private Status status = Status.PENDING;

    private UUID invitedUserId;

    @Column(name = "sms_sent", nullable = false)
    @Builder.Default
    private Boolean smsSent = false;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime fulfilledAt;

    public enum Status { PENDING, FULFILLED, CANCELLED }
}
