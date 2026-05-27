package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "merchant_settlement_items")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class MerchantSettlementItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID settlementId;

    @Column(nullable = false)
    private UUID checkoutSessionId;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal fee;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal net;

    private LocalDateTime transactionDate;
}
