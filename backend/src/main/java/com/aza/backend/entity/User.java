package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique = true, nullable = false)
    private String phone;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    private String firstName;
    private String lastName;
    private String displayName;
    private String pronouns;
    private LocalDate dateOfBirth;
    private String profileImageUrl;

    // --- Address ---
    private String homeAddress;
    private String city;
    private String nationality;
    private String otherNationality;
    private Boolean isTaxResidentAbroad;
    private String taxCountry;
    private Boolean isUSPerson;

    // --- Employment ---
    @Enumerated(EnumType.STRING)
    private EmploymentStatus employmentStatus;

    // --- Account Status ---
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private AccountStatus status = AccountStatus.ACTIVE;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private KycStatus kycStatus = KycStatus.NOT_STARTED;

    // --- Security ---
    @Builder.Default
    private Boolean biometricsEnabled = false;

    @Builder.Default
    private Boolean twoFactorEnabled = false;

    private String twoFactorSecret; // TOTP secret

    private String passcodeHash; // 5-digit PIN hash

    @Builder.Default
    private Boolean findMeByPhone = true;

    @Builder.Default
    private Boolean findMeByEmail = true;

    // --- E2EE Key Bundle ---
    @Column(columnDefinition = "TEXT")
    private String identityPublicKey;

    @Column(columnDefinition = "TEXT")
    private String signedPreKeyPublic;

    @Column(columnDefinition = "TEXT")
    private String signedPreKeySignature;

    @Column(columnDefinition = "TEXT")
    private String oneTimePreKeysJson;

    // --- Timestamps ---
    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    private LocalDateTime lastLoginAt;

    // ====== ENUMS ======

    public enum EmploymentStatus {
        STUDENT, PART_TIME, FULL_TIME, SELF_EMPLOYED, RETIRED, UNEMPLOYED
    }

    public enum AccountStatus {
        ACTIVE, DEACTIVATED, SUSPENDED
    }

    public enum KycStatus {
        NOT_STARTED, PENDING, UNDER_REVIEW, VERIFIED, REJECTED
    }
}
