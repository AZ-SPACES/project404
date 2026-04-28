package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "messages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID chatId;

    @Column(nullable = false)
    private UUID senderId;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String ciphertext;

    @Column(columnDefinition = "TEXT")
    private String ephemeralKey;

    private String preKeyId;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private MessageType type = MessageType.TEXT;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private MessageStatus status = MessageStatus.SENT;

    @CreationTimestamp
    private LocalDateTime sentAt;

    private LocalDateTime deliveredAt;
    private LocalDateTime readAt;

    @Builder.Default
    private Boolean isDeleted = false;

    private String mediaKey;

    public enum MessageType {
        TEXT, IMAGE, VIDEO, DOCUMENT, VOICE_NOTE
    }

    public enum MessageStatus {
        SENT, DELIVERED, READ
    }
}
