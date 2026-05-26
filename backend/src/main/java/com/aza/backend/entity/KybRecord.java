package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "kyb_records")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class KybRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private UUID merchantId;

    // Business registration info
    private String registrationNumber;

    @Enumerated(EnumType.STRING)
    private BusinessType businessType;

    private String registeredAddress;
    private String city;

    @Builder.Default
    private String country = "Ghana";

    private String taxIdNumber;
    private String website;

    // Owner / director info
    private String ownerFullName;
    private String ownerIdNumber;

    @Enumerated(EnumType.STRING)
    private OwnerIdType ownerIdType;

    // Status tracking
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private KybStatus status = KybStatus.PENDING;

    private String rejectionReason;
    private String moreInfoRequest;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime submittedAt;
    private LocalDateTime reviewedAt;

    public enum BusinessType {
        SOLE_PROPRIETOR, PARTNERSHIP, LIMITED_COMPANY, NGO, OTHER
    }

    public enum OwnerIdType {
        GHANA_CARD, PASSPORT, VOTER_ID, DRIVERS_LICENCE
    }

    public enum KybStatus {
        PENDING, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, MORE_INFO_REQUIRED
    }
}
