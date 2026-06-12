package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Customer complaints register (distinct from transaction disputes). BoG
 * complaint-handling rules expect acknowledgement and resolution within set
 * timelines, so every complaint carries deadlines from the moment it's logged.
 */
@Entity
@Table(name = "complaints")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Complaint {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Null when the complainant isn't an AZA user (e.g. a merchant's customer). */
    private UUID userId;

    @Column(length = 255)
    private String complainantName;

    @Column(length = 255)
    private String complainantContact;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Channel channel;

    @Column(nullable = false, length = 255)
    private String subject;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String details;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false, length = 20)
    private Status status = Status.OPEN;

    @Column(nullable = false)
    private LocalDate ackDueAt;

    @Column(nullable = false)
    private LocalDate resolveDueAt;

    private LocalDateTime acknowledgedAt;
    private LocalDateTime resolvedAt;

    @Column(length = 2000)
    private String resolution;

    private UUID handledBy;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public enum Channel { APP, EMAIL, PHONE, IN_PERSON, SOCIAL_MEDIA }

    public enum Status { OPEN, ACKNOWLEDGED, RESOLVED }
}
