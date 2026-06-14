package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "rate_limit_configs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class RateLimitConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 200)
    private String endpointPattern; // e.g. /api/v1/transfers/**

    @Column(length = 500)
    private String description;

    @Column(nullable = false)
    private int maxRequests;

    @Column(nullable = false)
    private int windowSeconds;

    @Column(nullable = false, length = 20)
    private String scope; // USER, IP, GLOBAL

    @Column(nullable = false)
    @Builder.Default
    private boolean enabled = true;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
