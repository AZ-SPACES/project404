package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "user_key_bundles",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_user_key_bundle",
                columnNames = {"user_id", "device_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserKeyBundle {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    /** Client-generated stable UUID identifying a physical install. */
    @Column(name = "device_id", nullable = false)
    private String deviceId;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String identityPublicKey;

    @Column(columnDefinition = "TEXT")
    private String signedPreKeyPublic;

    @Column(columnDefinition = "TEXT")
    private String signedPreKeySignature;

    /** JSON array of {keyId, publicKey} objects — consumed one at a time on fetch. */
    @Column(columnDefinition = "TEXT")
    private String oneTimePreKeysJson;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
