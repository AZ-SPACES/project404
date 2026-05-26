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

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private KeyType keyType = KeyType.SECRET;

    private String scopes; // comma-separated scopes, e.g. "sessions:read,sessions:write"

    private String ipWhitelist; // comma-separated whitelisted IPs/CIDRs

    private LocalDateTime expiresAt;

    private String oldKeyHash; // hash of the previous key during rollover

    private LocalDateTime oldKeyExpiresAt; // expiration of the rolled key grace period

    private String lastUsedIp;

    private String lastUsedUserAgent;

    @Builder.Default
    private Boolean isActive = true;

    private LocalDateTime lastUsedAt;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime revokedAt;

    public enum KeyEnvironment {
        LIVE, TEST;
    }

    public enum KeyType {
        SECRET, RESTRICTED;
    }
}
