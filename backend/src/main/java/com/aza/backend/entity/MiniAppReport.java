package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "mini_app_reports")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class MiniAppReport {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 100)
    private String appId;

    @Column(nullable = false)
    private UUID reportedByUserId;

    @Column(length = 100)
    private String reportedByHandle;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReportReason reason;

    @Column(columnDefinition = "TEXT")
    private String details;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private ReportStatus status = ReportStatus.OPEN;

    private UUID resolvedBy;

    private LocalDateTime resolvedAt;

    @Column(columnDefinition = "TEXT")
    private String resolution;

    @CreationTimestamp
    private LocalDateTime createdAt;

    public enum ReportReason {
        SPAM, INAPPROPRIATE, NOT_WORKING, MISLEADING, OTHER
    }

    public enum ReportStatus {
        OPEN, RESOLVED, DISMISSED
    }
}
