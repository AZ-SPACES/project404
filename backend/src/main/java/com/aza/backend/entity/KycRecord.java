package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "kyc_records")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KycRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private UUID userId;

    // Step 1 — Consent
    @Builder.Default
    private Boolean biometricConsent = false;
    private LocalDateTime consentTimestamp;
    private String consentIpAddress;

    // Step 2 — Source of Funds
    private String fundsSource;       // comma-separated: "salary,savings,business"
    private String otherFundsText;

    // Step 3 — ID Document
    @Enumerated(EnumType.STRING)
    private IdType idType;
    private String idNumber;
    private LocalDate idExpiryDate;
    private String idFrontImageUrl;   // Cloudinary URL
    private String idBackImageUrl;    // Cloudinary URL

    // Step 4 — Face Verification
    private String selfieImageUrl;    // Cloudinary URL

    // Step 5 — PEP Screening
    private Boolean isPep;

    @Enumerated(EnumType.STRING)
    private PepStatus pepStatus;
    private String pepRole;

    // Step 6 — EDD (PEP only)
    private String pepAccountPurpose;
    private String pepMonthlyVolume;
    private String pepWealthSource;
    private String pepProofDocType;
    private String pepProofDocUrl;    // Cloudinary URL

    // Status
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private KycStatus status = KycStatus.PENDING;

    private String rejectionReason;

    // Verification result (simulated for demo)
    private String verificationProvider;  // "SIMULATED" for demo, "SMILE_IDENTITY" for production
    private String verificationReference; // Provider reference ID

    @CreationTimestamp
    private LocalDateTime createdAt;
    private LocalDateTime submittedAt;
    private LocalDateTime verifiedAt;

    public enum IdType {
        GHANA_CARD, PASSPORT, VOTER_ID, DRIVERS_LICENCE
    }

    public enum PepStatus {
        SELF, FAMILY_ASSOCIATE
    }

    public enum KycStatus {
        PENDING, UNDER_REVIEW, VERIFIED, REJECTED
    }
}
