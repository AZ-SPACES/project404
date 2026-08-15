package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Someone Aza can pay a bill to — a utility, a network, a government agency.
 *
 * The catalogue is data rather than code because it changes on its own schedule: tariffs
 * move, agencies rename, a network adds a product. {@link #providerCode} is how whichever
 * aggregator Aza settles through names this biller, and is null until one is wired.
 */
@Entity
@Table(name = "billers", indexes = {
        @Index(name = "idx_billers_category", columnList = "category"),
        @Index(name = "idx_billers_active", columnList = "active"),
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Biller {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Stable identifier used by the app and by deep links. */
    @Column(nullable = false, unique = true, length = 60)
    private String slug;

    @Column(nullable = false, length = 120)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private Category category;

    @Column(length = 500)
    private String logoUrl;

    /** What to call the thing the payer types in — "Meter number", "Phone number". */
    @Column(nullable = false, length = 60)
    private String accountLabel;

    /**
     * What a valid account looks like for this biller.
     *
     * Checked before any money moves. A mistyped meter number is not a payment that
     * fails cleanly — it is a payment that succeeds into someone else's account.
     */
    @Column(length = 200)
    private String accountPattern;

    @Column(nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal minAmount = new BigDecimal("1.00");

    @Column(precision = 15, scale = 2)
    private BigDecimal maxAmount;

    /**
     * True when the biller's own system can confirm who an account belongs to, so the
     * payer sees a name before they commit.
     */
    @Column(nullable = false)
    @Builder.Default
    private boolean supportsNameLookup = false;

    /** How the settlement provider names this biller. Null until one is wired. */
    @Column(length = 60)
    private String providerCode;

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;

    public enum Category {
        ELECTRICITY,
        WATER,
        AIRTIME,
        DATA,
        TV,
        INTERNET,
        GOVERNMENT,
        INSURANCE,
        EDUCATION
    }
}
