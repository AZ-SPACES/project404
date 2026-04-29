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

    /** Set for PAYMENT_REQUEST messages — links to the PaymentRequest record. */
    private UUID paymentRequestId;

    /** If true, mediaKey is wiped after the recipient views it once. */
    @Builder.Default
    private Boolean viewOnce = false;

    /** Set when the recipient views a view-once media item. mediaKey is cleared at that point. */
    private LocalDateTime viewedAt;

    /** Set when the sender edits the message (TEXT only, within 15 minutes of sending). */
    private LocalDateTime editedAt;

    /** Set when the chat has disappearing messages enabled. Message is purged after this time. */
    private LocalDateTime expiresAt;

    public enum MessageType {
        TEXT, IMAGE, VIDEO, DOCUMENT, VOICE_NOTE, PAYMENT_REQUEST
    }

    public enum MessageStatus {
        SENT, DELIVERED, READ
    }
}
