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

    /** Seconds after which new messages auto-delete. Null = disabled. */
    private Integer disappearingMessagesTtl;

    @Builder.Default
    private Boolean isMutedByOne = false;

    @Builder.Default
    private Boolean isMutedByTwo = false;

    @Builder.Default
    private Boolean isArchivedByOne = false;

    @Builder.Default
    private Boolean isArchivedByTwo = false;

    @Builder.Default
    private boolean isSupport = false;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private ChatStatus status = ChatStatus.OPEN;

    private LocalDateTime resolvedAt;
    private String resolvedByName;

    /** Topic the user selected before starting the chat. */
    private String category;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Priority priority = Priority.NORMAL;

    @CreationTimestamp
    private LocalDateTime createdAt;

    /** True while the AI bot is handling this chat; false after admin takeover. */
    @Builder.Default
    private Boolean botActive = true;

    /** UUID of the admin who took over from the bot. Null while bot is active. */
    private UUID activeAgentId;

    private LocalDateTime handedOverAt;

    public enum ChatStatus { OPEN, PENDING, RESOLVED }
    public enum Priority { LOW, NORMAL, HIGH, URGENT }
}
