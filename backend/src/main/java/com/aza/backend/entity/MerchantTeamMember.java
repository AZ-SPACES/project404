package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "merchant_team_members",
    uniqueConstraints = @UniqueConstraint(columnNames = {"merchant_id", "email"}))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class MerchantTeamMember {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "merchant_id", nullable = false)
    private UUID merchantId;

    @Column(nullable = false)
    private String email;

    private UUID userId; // null until accepted

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private TeamRole role = TeamRole.VIEWER;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private TeamStatus status = TeamStatus.PENDING;

    @Column(unique = true)
    private String inviteToken;

    @CreationTimestamp
    private LocalDateTime invitedAt;

    private LocalDateTime joinedAt;

    public enum TeamRole { ADMIN, DEVELOPER, VIEWER }
    public enum TeamStatus { PENDING, ACTIVE, REVOKED }
}
