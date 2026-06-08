package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "oauth_access_tokens")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class OAuthAccessToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id", nullable = false)
    private OAuthClient client;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "token_hash", nullable = false, unique = true)
    private String tokenHash;

    @Column(name = "scopes", nullable = false, columnDefinition = "TEXT")
    private String scopes;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "refresh_token_hash", unique = true)
    private String refreshTokenHash;

    @Column(name = "refresh_expires_at")
    private LocalDateTime refreshExpiresAt;

    @Builder.Default
    private boolean revoked = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public List<String> getScopeList() {
        return Arrays.asList(scopes.split(","));
    }

    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiresAt);
    }

    public boolean isRefreshExpired() {
        return refreshExpiresAt == null || LocalDateTime.now().isAfter(refreshExpiresAt);
    }
}
