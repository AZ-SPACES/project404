package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "admin_notes")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AdminNote {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID subjectUserId;

    @Column(nullable = false, length = 2000)
    private String note;

    @Column(nullable = false, length = 100)
    private String createdBy; // admin email

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
