package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "merchant_payouts")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class MerchantPayout {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID merchantId;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Builder.Default
    private String currency = "GHS";

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private PayoutStatus status = PayoutStatus.PENDING;

    private String note;

    @CreationTimestamp
    private LocalDateTime requestedAt;

    private LocalDateTime completedAt;
    private LocalDateTime failedAt;
    private String failureReason;

    public enum PayoutStatus {
        PENDING, COMPLETED, FAILED
    }
}
