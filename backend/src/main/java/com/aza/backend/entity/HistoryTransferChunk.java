package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

/** One opaque encrypted chunk of a history transfer. */
@Entity
@Table(name = "history_transfer_chunks",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_history_transfer_chunk",
                columnNames = {"transfer_id", "seq"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HistoryTransferChunk {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "transfer_id", nullable = false)
    private UUID transferId;

    @Column(nullable = false)
    private int seq;

    /** base64 of a client-side-encrypted envelope — never plaintext. */
    @Column(columnDefinition = "TEXT", nullable = false)
    private String payload;
}
