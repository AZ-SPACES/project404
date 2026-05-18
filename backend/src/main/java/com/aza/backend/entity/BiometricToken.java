package com.aza.backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;


@Entity
@Table(name = "biometric_tokens")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BiometricToken {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    @JsonIgnore
    @Column(nullable = false, unique = true)
    private String tokenHash;

    private String deviceName;
    private String deviceOs;
    private String deviceId;

    @Builder.Default
    private Boolean active = true;

    private LocalDateTime lastUsedAt;

    @Column(nullable = false)
    private LocalDateTime expiresAt;


    @CreationTimestamp
    private LocalDateTime createdAt;

    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiresAt);
    }
}
