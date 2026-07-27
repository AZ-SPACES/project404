package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@SQLDelete(sql = "UPDATE users SET deleted_at = NOW() WHERE id = ?")
@SQLRestriction("deleted_at IS NULL")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // --- Identity & Access ---
    private String firstName;
    private String lastName;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(name = "phone_number", unique = true, nullable = false)
    private String phoneNumber;

    @Column(precision = 15, scale = 2)
    @Builder.Default
    private java.math.BigDecimal balance = java.math.BigDecimal.ZERO;

    @Column(name = "username", unique = true)
    private String username;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private UserRole role = UserRole.USER;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private AccountStatus status = AccountStatus.ACTIVE;

    private String deactivationReason;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private KycStatus kycStatus = KycStatus.NOT_STARTED;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private OnlineStatus onlineStatus = OnlineStatus.OFFLINE;

    /** Persisted on offline transitions — powers "last seen" when Redis has no live value. */
    private LocalDateTime lastSeenAt;

    // --- Profile Information ---
    private String pronouns;
    private LocalDate dateOfBirth;
    private String profileImageUrl;

    // --- Address & Compliance ---
    private String homeAddress;
    private String city;
    private String nationality;
    private String otherNationality;
    private Boolean isTaxResidentAbroad;
    private String taxCountry;
    private Boolean isUSPerson;

    @Enumerated(EnumType.STRING)
    private EmploymentStatus employmentStatus;

    // --- Security & Authentication ---
    @Column(nullable = false)
    private String passwordHash;

    private String passcodeHash; // 4-digit PIN hash

    @Builder.Default
    private Boolean biometricsEnabled = false;

    @Builder.Default
    private Boolean twoFactorEnabled = false;

    private String twoFactorSecret; // TOTP secret

    @Builder.Default
    private Boolean smsTwoFactorEnabled = false;

    @Builder.Default
    private Boolean emailTwoFactorEnabled = false;

    @Builder.Default
    private Boolean appTwoFactorEnabled = false;

    @Builder.Default
    private Boolean passkeysEnabled = false;

    @Enumerated(EnumType.STRING)
    private TwoFactorMethod defaultTwoFactorMethod;

    /** Periodic KYC re-verification deadline; set to +1 year on each approval. */
    private LocalDateTime kycReviewDueAt;

    @Builder.Default
    private Boolean forcePasswordReset = false;

    @Builder.Default
    private Boolean requireSelfieVerification = false;

    // --- Privacy & Preferences ---
    @Builder.Default
    private Boolean findMeByPhone = true;

    @Builder.Default
    private Boolean findMeByEmail = true;

    @Builder.Default
    private Boolean findMeByHandle = true;

    @Builder.Default
    private Boolean syncContacts = true;

    /** When false, other users see OFFLINE and no last-seen; admin views are unaffected. */
    @Builder.Default
    private Boolean showOnlineStatus = true;

    @Builder.Default
    private Boolean billForwardingEnabled = false;

    @Column(columnDefinition = "TEXT")
    private String notificationPreferences;

    // --- Display & Appearance ---
    @Builder.Default
    private String language = "English (US)";

    @Builder.Default
    private String theme = "System Default";

    private String homeBackground;
    private String hubBackground;

    // --- Silent Hours ---
    @Builder.Default
    private Boolean silentHoursEnabled = false;

    /** HH:mm 24-hour start of silent period (e.g. "22:00"). */
    private String silentHoursStart;

    /** HH:mm 24-hour end of silent period (e.g. "07:00"). Wraps midnight if before start. */
    private String silentHoursEnd;

    /**
     * Minimum payment amount (GHS) that bypasses silent hours and triggers a push.
     * Null = no payment notifications break through during silent hours.
     * Zero = all payment notifications break through.
     */
    private java.math.BigDecimal silentHoursPaymentThreshold;

    // --- Per-user transaction limit overrides (null = use global default) ---
    @Column(precision = 15, scale = 2)
    private java.math.BigDecimal customDailyLimitGhs;

    @Column(precision = 15, scale = 2)
    private java.math.BigDecimal customSingleTransactionLimitGhs;

    /** BoG e-money KYC tier; drives default transaction caps and the wallet-balance ceiling. */
    @Enumerated(jakarta.persistence.EnumType.STRING)
    @Column(length = 20)
    @Builder.Default
    private KycTier kycTier = KycTier.TIER_1;

    // --- Referral ---
    @Column(name = "referral_code", unique = true, length = 12)
    private String referralCode;

    // --- Metadata ---
    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    private LocalDateTime lastLoginAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    /** Set when user requests deletion; erasure runs 30 days later. */
    private LocalDateTime scheduledDeletionAt;

    // ====== ENUMS ======

    public enum EmploymentStatus {
        STUDENT, PART_TIME, FULL_TIME, SELF_EMPLOYED, RETIRED, UNEMPLOYED
    }

    public enum AccountStatus {
        ACTIVE, DEACTIVATED, SUSPENDED, PENDING_DELETION
    }

    public enum KycStatus {
        NOT_STARTED, PENDING, UNDER_REVIEW, VERIFIED, REJECTED
    }

    public enum OnlineStatus {
        ONLINE, OFFLINE, AWAY
    }

    public enum UserRole {
        USER, ADMIN
    }

    public enum TwoFactorMethod {
        TOTP, SMS, EMAIL, APP, PASSKEY
    }
}
