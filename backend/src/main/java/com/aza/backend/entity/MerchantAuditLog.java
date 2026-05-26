package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "merchant_audit_logs")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class MerchantAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID merchantId;

    @Column(nullable = false)
    private String action; // e.g. "PAYOUT_REQUESTED", "API_KEY_CREATED", "WEBHOOK_CREATED", "SETTINGS_UPDATED", "LOGO_UPDATED", "KEY_REVOKED", "KEY_ROLLED"

    private String actorEmail; // email of the user who performed the action

    @Column(columnDefinition = "TEXT")
    private String details; // JSON or plain text

    @CreationTimestamp
    private LocalDateTime timestamp;
}
