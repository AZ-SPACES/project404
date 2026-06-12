package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A potential hit between a user and a watchlist entry, queued for COMPLIANCE
 * review. Most name matches are false positives; a match is only acted on once
 * a reviewer confirms it (which also raises a RiskAlert).
 */
@Entity
@Table(name = "screening_matches")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScreeningMatch {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private UUID listEntryId;

    /** Denormalized for queue readability even if the list entry is later deactivated. */
    @Column(nullable = false, length = 50)
    private String listName;

    @Column(nullable = false)
    private String listEntryName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SanctionsListEntry.EntryType entryType;

    /** 0–100; how strongly the names matched. */
    @Column(nullable = false)
    private int matchScore;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false, length = 20)
    private Status status = Status.PENDING_REVIEW;

    @Column(length = 1000)
    private String notes;

    private UUID reviewedBy;
    private LocalDateTime reviewedAt;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public enum Status { PENDING_REVIEW, FALSE_POSITIVE, CONFIRMED }
}
