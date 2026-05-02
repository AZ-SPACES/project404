package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "fee_rules")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class FeeRule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false, length = 50)
    private String transactionType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private FeeType feeType;

    @Column(nullable = false, precision = 10, scale = 4)
    private BigDecimal amount;

    @Column(precision = 15, scale = 2)
    private BigDecimal minFee;

    @Column(precision = 15, scale = 2)
    private BigDecimal maxFee;

    @Column(precision = 15, scale = 2)
    private BigDecimal tierMinAmount;

    @Column(precision = 15, scale = 2)
    private BigDecimal tierMaxAmount;

    @Builder.Default
    private Boolean active = true;

    @CreationTimestamp
    private LocalDateTime effectiveFrom;

    public enum FeeType { FLAT, PERCENTAGE }
}
