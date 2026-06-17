package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A user-submitted report against a scanned handle / store code (e.g. a scam or
 * impersonating merchant). Feeds the back-office screening queue. Mirrors the
 * {@link MiniAppReport} flow but targets payment handles rather than mini apps.
 */
@Entity
@Table(name = "handle_reports")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class HandleReport {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** The reported handle / store code (without a leading @). */
    @Column(nullable = false, length = 100)
    private String reportedHandle;

    /** Set when the reported handle resolves to a known merchant. */
    private UUID reportedMerchantId;

    @Column(nullable = false)
    private UUID reportedByUserId;

    @Column(length = 100)
    private String reportedByHandle;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ReportReason reason;

    @Column(columnDefinition = "TEXT")
    private String details;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false, length = 20)
    private ReportStatus status = ReportStatus.OPEN;

    private UUID resolvedBy;

    private LocalDateTime resolvedAt;

    @Column(columnDefinition = "TEXT")
    private String resolution;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public enum ReportReason {
        SCAM, IMPERSONATION, INAPPROPRIATE, NOT_RECEIVED, OTHER
    }

    public enum ReportStatus {
        OPEN, RESOLVED, DISMISSED
    }
}
