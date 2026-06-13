package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "promo_code_redemptions")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class PromoCodeRedemption {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID promoCodeId;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal creditAmountGhs;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime redeemedAt;
}
