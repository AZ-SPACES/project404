package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "notifications")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notification {

    @Id
    @GeneratedValue( strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NotificationType type;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String body;

    @Column(columnDefinition = "TEXT")
    private String data;

    @Column
    private String imageUrl;

    @Builder.Default
    private Boolean isRead = false;

    @CreationTimestamp
    private LocalDateTime createdAt;

    public enum NotificationType {
        NEW_MESSAGE,
        INCOMING_CALL,
        MISSED_CALL,
        MONEY_RECEIVED,
        MONEY_REQUESTED,
        KYC_APPROVED,
        KYC_REJECTED,
        TRANSFER_COMPLETED,
        SECURITY_ALERT,
        LOW_OPK,
        PAYMENT_REQUEST_RECEIVED,
        PAYMENT_REQUEST_PAID,
        PAYMENT_REQUEST_DECLINED,
        PAYMENT_REQUEST_EXPIRED,
        PAYMENT_REQUEST_CANCELLED,
        SYSTEM_BROADCAST,
        LOGIN_APPROVAL,
        KYB_APPROVED,
        KYB_REJECTED,
        KYB_MORE_INFO_REQUIRED,
        RECOVERY_CONTACT_INVITE,
        RECOVERY_CONTACT_REQUEST,
        LIMIT_INCREASE,
        AGENT_APPROVED,
        AGENT_REJECTED,
        AGENT_SUSPENDED
    }

}
