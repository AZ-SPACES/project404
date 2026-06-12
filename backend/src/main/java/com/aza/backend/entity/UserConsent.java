package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A user's acceptance of a versioned legal document (DPA evidence). Append-only:
 * accepting a new version adds a row, so the history of what was agreed to and
 * when is permanent.
 */
@Entity
@Table(name = "user_consents")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserConsent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private DocType docType;

    @Column(nullable = false, length = 50)
    private String version;

    @Column(length = 45)
    private String ipAddress;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime acceptedAt;

    public enum DocType { TERMS, PRIVACY }
}
