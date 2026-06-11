package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

/** One opaque encrypted chunk of a chat backup. */
@Entity
@Table(name = "chat_backup_chunks",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_chat_backup_chunk",
                columnNames = {"backup_id", "seq"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatBackupChunk {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "backup_id", nullable = false)
    private UUID backupId;

    @Column(nullable = false)
    private int seq;

    /** base64 of a client-side-encrypted envelope — never plaintext. */
    @Column(columnDefinition = "TEXT", nullable = false)
    private String payload;
}
