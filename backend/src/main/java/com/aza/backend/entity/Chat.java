package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "chats")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Chat {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID participantOneId;

    @Column(nullable = false)
    private UUID participantTwoId;

    private LocalDateTime lastMessageAt;

    @Builder.Default
    private Boolean isMutedByOne = false;

    @Builder.Default
    private Boolean isMutedByTwo = false;

    @Builder.Default
    private Boolean isArchivedByOne = false;

    @Builder.Default
    private Boolean isArchivedByTwo = false;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
