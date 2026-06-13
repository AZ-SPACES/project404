package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "mini_app_consents",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "app_id"}))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class MiniAppConsent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "app_id", nullable = false, length = 100)
    private String appId;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "mini_app_consent_permissions",
            joinColumns = @JoinColumn(name = "consent_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "permission", length = 30)
    @Builder.Default
    private Set<MiniApp.Permission> grantedPermissions = new LinkedHashSet<>();

    @CreationTimestamp
    private LocalDateTime grantedAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
