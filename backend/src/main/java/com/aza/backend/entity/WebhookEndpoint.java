package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "webhook_endpoints")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class WebhookEndpoint {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID merchantId;

    @Column(nullable = false)
    private String url;

    @Column(nullable = false)
    private String signingSecret; // stored plaintext — needed to sign outgoing requests

    @Builder.Default
    private Boolean isActive = true;

    // comma-separated event types: "checkout.completed,checkout.expired"
    @Builder.Default
    private String events = "checkout.completed";

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
