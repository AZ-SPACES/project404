package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "blocked_users",
    uniqueConstraints = @UniqueConstraint(columnNames = {"blocker_id", "blocked_user_id"}),
    indexes = {
        @Index(name = "idx_blocked_blocker",  columnList = "blocker_id"),
        @Index(name = "idx_blocked_target",   columnList = "blocked_user_id")
    }
)
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class BlockedUser {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "blocker_id", nullable = false)
    private UUID blockerId;

    @Column(name = "blocked_user_id", nullable = false)
    private UUID blockedUserId;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
