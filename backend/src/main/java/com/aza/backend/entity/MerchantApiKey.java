package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "merchant_api_keys")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class MerchantApiKey {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID merchantId;

    private String label;

    @Column(nullable = false)
    private String keyPrefix; // e.g. "aza_live_AbCd" — first 16 chars, shown in dashboard

    @Column(nullable = false, unique = true)
    private String keyHash; // SHA-256 hex of the full key

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private KeyEnvironment environment = KeyEnvironment.LIVE;

    @Builder.Default
    private Boolean isActive = true;

    private LocalDateTime lastUsedAt;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime revokedAt;

    public enum KeyEnvironment {
        LIVE, TEST
    }
}
