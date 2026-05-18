package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "contact_requests", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"sender_user_id", "receiver_user_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContactRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "sender_user_id", nullable = false)
    private UUID senderUserId;

    @Column(name = "receiver_user_id", nullable = false)
    private UUID receiverUserId;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private RequestStatus status = RequestStatus.PENDING;

    @CreationTimestamp
    private LocalDateTime createdAt;

    public enum RequestStatus {
        PENDING, APPROVED, REJECTED
    }
}
