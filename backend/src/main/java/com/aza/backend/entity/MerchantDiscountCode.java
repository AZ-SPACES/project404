package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "merchant_discount_codes",
        uniqueConstraints = @UniqueConstraint(columnNames = {"merchant_id", "code"}))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class MerchantDiscountCode {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "merchant_id", nullable = false)
    private UUID merchantId;

    @Column(nullable = false)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DiscountType discountType;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal value;

    private Integer maxUses;

    @Builder.Default
    private int usedCount = 0;

    private LocalDateTime expiresAt;

    @Builder.Default
    private boolean active = true;

    @CreationTimestamp
    private LocalDateTime createdAt;

    public enum DiscountType {
        PERCENTAGE, FIXED
    }
}
