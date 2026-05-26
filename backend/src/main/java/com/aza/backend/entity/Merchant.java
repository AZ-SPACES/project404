package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "merchants")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Merchant {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private UUID userId;

    @Column(nullable = false)
    private String businessName;

    @Column(unique = true)
    private String businessHandle;

    private String businessEmail;
    private String businessPhone;
    private String businessDescription;

    @Column(columnDefinition = "TEXT")
    private String logoUrl;

    @Enumerated(EnumType.STRING)
    private BusinessCategory category;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private MerchantStatus status = MerchantStatus.PENDING_KYB;

    private String rejectionReason;
    private String moreInfoRequest;

    @Column(nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal balance = BigDecimal.ZERO;

    @Builder.Default
    private String currency = "GHS";

    @Column(precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal totalVolume = BigDecimal.ZERO;

    @Builder.Default
    private Integer feeRateBps = 150; // 1.5%

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    private LocalDateTime activatedAt;

    public enum MerchantStatus {
        PENDING_KYB, KYB_SUBMITTED, KYB_UNDER_REVIEW, MORE_INFO_REQUIRED, ACTIVE, SUSPENDED, REJECTED
    }

    public enum BusinessCategory {
        RETAIL, FOOD_AND_BEVERAGE, SERVICES, TECHNOLOGY, HEALTHCARE, EDUCATION,
        ENTERTAINMENT, TRANSPORT, REAL_ESTATE, AGRICULTURE, FINANCE, OTHER
    }
}
