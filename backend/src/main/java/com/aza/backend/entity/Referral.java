package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "referrals", indexes = {
        @Index(columnList = "referrer_id"),
        @Index(columnList = "code")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Referral {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "referrer_id", nullable = false)
    private UUID referrerId;

    @Column(name = "referred_user_id", nullable = false, unique = true)
    private UUID referredUserId;

    @Column(nullable = false, length = 12)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.PENDING;

    @Column(nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal rewardAmount = BigDecimal.ZERO;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime rewardedAt;

    public enum Status { PENDING, REWARDED, CANCELLED }
}
