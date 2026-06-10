package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

/**
 * One encrypted envelope per (message, device). Each send stores one row for
 * every recipient device and every sender device (except the sending device
 * itself, which already holds the plaintext).
 */
@Entity
@Table(name = "message_ciphertexts",
        indexes = @Index(name = "idx_message_ciphertexts_message_id", columnList = "message_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MessageCiphertext {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "message_id", nullable = false)
    private UUID messageId;

    /** The device this envelope is encrypted for. */
    @Column(name = "device_id", nullable = false)
    private String deviceId;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String ciphertext;

    @Column(columnDefinition = "TEXT")
    private String ephemeralKey;

    private String preKeyId;

    /** Non-null on the first message of a session — lets the recipient run X3DH. */
    @Column(columnDefinition = "TEXT")
    private String senderIdentityPublicKey;
}
