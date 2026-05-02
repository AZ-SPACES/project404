package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "admin_audit_log")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID adminId;
    private String adminEmail;
    private String adminName;

    @Column(nullable = false)
    private String action; // e.g. "SUSPEND_USER", "APPROVE_KYC", "REJECT_KYC", "CHANGE_ROLE", "FREEZE_WALLET", "BROADCAST_NOTIFICATION"

    private UUID targetUserId; // nullable — some actions don't target a user
    private String targetUserEmail; // denormalized for log readability

    @Column(columnDefinition = "TEXT")
    private String details; // JSON or plain text context

    @CreationTimestamp
    private LocalDateTime timestamp;
}
