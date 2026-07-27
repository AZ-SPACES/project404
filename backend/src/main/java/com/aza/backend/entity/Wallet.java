package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "wallets", uniqueConstraints =
        @UniqueConstraint(name = "wallets_user_id_type_key", columnNames = {"user_id", "type"}))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Wallet {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    /**
     * Distinguishes a user's everyday {@code PERSONAL} wallet from an agent's
     * ring-fenced {@code AGENT_FLOAT} wallet. Uniqueness is per (userId, type),
     * so an agent holds exactly one of each.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private WalletType type = WalletType.PERSONAL;

    @Column(nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal balance = BigDecimal.ZERO;

    @Column(length = 3)
    @Builder.Default
    private String currency = "GHS";

    @Builder.Default
    private Boolean frozen = false;

    @UpdateTimestamp
    private LocalDateTime lastUpdatedAt;

    public enum WalletType { PERSONAL, AGENT_FLOAT }
}
