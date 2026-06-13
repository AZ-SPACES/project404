package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "regulatory_filings")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class RegulatoryFiling {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private FilingType type;

    /** e.g. "2026-05" for BOG_RETURNS, "2026-05-01" for STR/JOURNAL date range */
    @Column(nullable = false, length = 20)
    private String period;

    @Column(length = 500)
    private String notes;

    @Column(nullable = false)
    private String filedByEmail;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime filedAt;

    public enum FilingType {
        BOG_MONTHLY_RETURNS,
        STR_BATCH,
        ACCOUNTING_JOURNAL
    }
}
