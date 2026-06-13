package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "device_blocks", indexes = @Index(columnList = "device_id", unique = true))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DeviceBlock {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "device_id", nullable = false, unique = true, length = 255)
    private String deviceId;

    /** Human-readable label from the RefreshToken at time of block. */
    @Column(length = 255)
    private String deviceName;

    @Column(length = 50)
    private String deviceOs;

    /** UUID of the user whose session surfaced this device (context only, not a FK). */
    private UUID associatedUserId;

    @Column(length = 500)
    private String reason;

    @Column(nullable = false)
    private String blockedByEmail;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime blockedAt;
}
