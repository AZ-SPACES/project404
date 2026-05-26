package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "merchant_subscriptions")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class MerchantSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID planId;

    @Column(nullable = false)
    private UUID merchantId;

    private UUID customerId; // AZA user id

    private String customerName;
    private String customerEmail;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private SubscriptionStatus status = SubscriptionStatus.ACTIVE;

    private LocalDateTime nextBillingAt;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime cancelledAt;

    public enum SubscriptionStatus { ACTIVE, PAUSED, CANCELLED, EXPIRED }
}
