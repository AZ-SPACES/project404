package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "merchant_api_logs")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class MerchantApiLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID merchantId;

    private UUID apiKeyId;

    @Column(nullable = false)
    private String method;

    @Column(nullable = false)
    private String path;

    private Integer statusCode;

    private String ipAddress;

    private String userAgent;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
