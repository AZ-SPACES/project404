package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "account_closure_requests")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AccountClosureRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.PENDING;

    @Column(nullable = false, length = 1000)
    private String reason;

    @Column
    private String notes;

    @Column
    private String processedBy;

    @Column
    private LocalDateTime processedAt;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime requestedAt;

    public enum Status {
        PENDING, APPROVED, REJECTED
    }
}
