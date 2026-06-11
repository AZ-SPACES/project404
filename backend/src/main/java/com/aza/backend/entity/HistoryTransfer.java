package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A device-to-device chat history transfer. The requesting (new) device opens
 * one; another of the user's devices claims it, uploads the user's local
 * history re-encrypted to the requesting device's identity key, and marks it
 * READY. The server only ever relays opaque encrypted chunks.
 */
@Entity
@Table(name = "history_transfers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HistoryTransfer {

    public enum Status { PENDING, UPLOADING, READY, COMPLETED, DECLINED, EXPIRED }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    /** The new device asking for history. */
    @Column(name = "requesting_device_id", nullable = false)
    private String requestingDeviceId;

    /** The existing device that claimed the request and uploads the history. */
    @Column(name = "source_device_id")
    private String sourceDeviceId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.PENDING;

    /** Set when the source device completes the upload. */
    @Column(name = "chunk_count")
    private Integer chunkCount;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;
}
