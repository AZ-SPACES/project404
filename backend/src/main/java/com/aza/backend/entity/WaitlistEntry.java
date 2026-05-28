package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "waitlist_entries",
    uniqueConstraints = @UniqueConstraint(name = "uq_waitlist_email", columnNames = "email")
)
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class WaitlistEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 320)
    private String email;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "confirmation_sent")
    @Builder.Default
    private boolean confirmationSent = false;

    @Column(name = "invite_code", unique = true)
    private String inviteCode;

    @Column(name = "invited_at")
    private LocalDateTime invitedAt;
}
