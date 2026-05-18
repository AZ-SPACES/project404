package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "contacts", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"owner_user_id", "phone_number"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Contact {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "owner_user_id", nullable = false)
    private UUID ownerUserId;

    @Column(name = "contact_user_id")
    private UUID contactUserId;

    private String displayName;

    @Column(name = "phone_number")
    private String phoneNumber;

    private String email;

    @Builder.Default
    private Boolean isAzaUser = false;

    @Builder.Default
    private Boolean isFavorite = false;

    @CreationTimestamp
    private LocalDateTime createdAt;
}

