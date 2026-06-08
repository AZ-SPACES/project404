package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "oauth_clients")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class OAuthClient {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "client_id", unique = true, nullable = false, length = 64)
    private String clientId;

    @Column(name = "client_secret_hash", nullable = false)
    private String clientSecretHash;

    @Column(name = "app_name", nullable = false)
    private String appName;

    @Column(name = "app_description", columnDefinition = "TEXT")
    private String appDescription;

    @Column(name = "logo_url", length = 500)
    private String logoUrl;

    @Column(name = "website_url", length = 500)
    private String websiteUrl;

    @Column(name = "redirect_uris", nullable = false, columnDefinition = "TEXT")
    private String redirectUris;

    @Column(name = "allowed_scopes", nullable = false, columnDefinition = "TEXT")
    private String allowedScopes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Builder.Default
    private boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public List<String> getRedirectUriList() {
        return Arrays.asList(redirectUris.split(","));
    }

    public List<String> getAllowedScopeList() {
        return Arrays.asList(allowedScopes.split(","));
    }
}
