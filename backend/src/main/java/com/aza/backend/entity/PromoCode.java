package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "promo_codes")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class PromoCode {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @Column(length = 500)
    private String description;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal creditAmountGhs;

    private Integer maxUses;

    @Column(nullable = false)
    @Builder.Default
    private int usedCount = 0;

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    private LocalDateTime expiresAt;

    @Column(length = 100)
    private String createdBy;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
