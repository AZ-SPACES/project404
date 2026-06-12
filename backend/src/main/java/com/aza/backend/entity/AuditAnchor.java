package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Daily tamper-evidence anchor for the admin audit log: a SHA-256 over the
 * day's entries chained to the previous anchor's hash. Deleting or editing a
 * historical audit row breaks every anchor from that day forward, which the
 * verify endpoint detects. (Truly immutable storage would be off-box; this
 * makes tampering detectable, not impossible.)
 */
@Entity
@Table(name = "audit_anchors")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditAnchor {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private LocalDate anchorDate;

    @Column(nullable = false)
    private long entryCount;

    /** SHA-256 hex over prevHash + canonical form of the day's entries. */
    @Column(nullable = false, length = 64)
    private String contentHash;

    /** Hash of the previous anchor; "GENESIS" for the first. */
    @Column(nullable = false, length = 64)
    private String prevHash;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
