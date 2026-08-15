package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A bill that gets split the same way every month — rent, the water, the wifi.
 *
 * These are the splits people actually live with, and re-entering the same four
 * housemates every month is the reason they stop using an app for it. The definition is
 * stored once and produces an ordinary split on schedule; nothing about the resulting
 * split is special, so everything downstream of it — the asks, the netting, the
 * reminders — works without knowing this exists.
 *
 * People are held by id rather than by handle: resolving a username every month would
 * break the split the day somebody changed theirs.
 */
@Entity
@Table(name = "recurring_splits", indexes = {
        @Index(name = "idx_recurring_splits_creator", columnList = "creatorId"),
        @Index(name = "idx_recurring_splits_due", columnList = "active,nextRunOn"),
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class RecurringSplit {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Version
    private Long version;

    @Column(nullable = false)
    private UUID creatorId;

    @Column(nullable = false, length = 140)
    private String description;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal totalAmount;

    @Column(nullable = false, length = 3)
    @Builder.Default
    private String currency = "GHS";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private ExpenseSplit.SplitMode splitMode = ExpenseSplit.SplitMode.EQUAL;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    @Builder.Default
    private Frequency frequency = Frequency.MONTHLY;

    /**
     * Which day it falls on: of the month for MONTHLY, of the week for WEEKLY.
     *
     * Capped at 28 for monthly so a rent split does not silently skip February.
     */
    @Column(nullable = false)
    private int dayOfPeriod;

    /** The next date this is due to produce a split. */
    @Column(nullable = false)
    private LocalDate nextRunOn;

    private LocalDate lastRunOn;

    /** Paused rather than deleted, so the people and amounts survive a quiet month. */
    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    @CreationTimestamp
    private LocalDateTime createdAt;

    public enum Frequency {
        WEEKLY,
        MONTHLY
    }
}
