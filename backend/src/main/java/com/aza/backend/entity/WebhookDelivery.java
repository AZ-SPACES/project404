package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "webhook_deliveries")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class WebhookDelivery {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID endpointId;

    @Column(nullable = false)
    private UUID checkoutSessionId;

    @Column(nullable = false)
    private String eventType;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String payload;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private DeliveryStatus status = DeliveryStatus.PENDING;

    @Builder.Default
    private Integer attemptCount = 0;

    private Integer responseStatusCode;

    @Column(columnDefinition = "TEXT")
    private String responseBody;

    private LocalDateTime nextRetryAt;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime lastAttemptAt;

    public enum DeliveryStatus {
        PENDING, SUCCESS, FAILED, ABANDONED
    }
}
