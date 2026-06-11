package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A back-office privilege held by a staff member, who is also a regular AZA user.
 * Rows are never deleted: revocation sets revokedAt/revokedBy so the history of
 * who held which power is permanent. A user's effective roles are the rows where
 * revokedAt is null.
 */
@Entity
@Table(name = "staff_roles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StaffRole {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private Role role;

    private UUID grantedBy;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime grantedAt;

    private LocalDateTime revokedAt;

    private UUID revokedBy;

    public boolean isActive() {
        return revokedAt == null;
    }

    public enum Role {
        SUPPORT,     // user/transaction lookup, support chats, disputes
        COMPLIANCE,  // KYC review, AML flags, risk alerts, account freezes
        FINANCE,     // wallets, fees, merchant settlements, revenue reports
        ADMIN        // everything, including settings, kill switch, role grants
    }
}
