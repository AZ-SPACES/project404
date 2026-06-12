package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A data-protection request (Ghana DPA): a user asking for a copy of their data
 * or for deletion. Tracked with a due date so nothing slips past the statutory
 * response window; actual deletion runs through the existing PENDING_DELETION flow.
 */
@Entity
@Table(name = "data_requests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DataRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RequestType type;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false, length = 20)
    private Status status = Status.OPEN;

    @Column(nullable = false)
    private LocalDate dueDate;

    @Column(length = 1000)
    private String notes;

    private UUID handledBy;
    private LocalDateTime completedAt;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public enum RequestType { ACCESS, DELETION }

    public enum Status { OPEN, IN_PROGRESS, COMPLETED, REJECTED }
}
