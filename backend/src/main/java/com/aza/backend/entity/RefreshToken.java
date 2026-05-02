package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "refresh_tokens")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false, unique = true)
    private String tokenHash;

    /** SHA-256 hash of the paired access token — used to blacklist it on device removal. */
    @Column(unique = true)
    private String accessTokenHash;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    /** Expiry of the paired access token — needed to set the correct Redis TTL on blacklist. */
    private LocalDateTime accessTokenExpiresAt;

    private String deviceName;
    private String deviceOs;
    private String deviceId;
    private String ipAddress;

    @CreationTimestamp
    private LocalDateTime createdAt;

    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiresAt);
    }
}
