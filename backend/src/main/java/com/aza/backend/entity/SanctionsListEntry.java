package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A name on a watchlist (UN/OFAC sanctions, PEP lists, local watchlists).
 * Entries are managed by COMPLIANCE; users are screened against active entries
 * daily and at any time on demand.
 */
@Entity
@Table(name = "sanctions_list_entries")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SanctionsListEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Which list this came from, e.g. "UN", "OFAC", "GH-PEP". */
    @Column(nullable = false, length = 50)
    private String listName;

    @Column(nullable = false)
    private String fullName;

    /** Lowercased, punctuation-stripped form used by the matcher. */
    @Column(nullable = false)
    private String normalizedName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EntryType entryType;

    private String country;

    @Column(length = 500)
    private String notes;

    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;

    private UUID addedBy;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public enum EntryType { SANCTION, PEP }
}
