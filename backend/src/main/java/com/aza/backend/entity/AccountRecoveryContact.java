package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "account_recovery_contacts", indexes = {
    @Index(name = "idx_arc_user", columnList = "user_id"),
    @Index(name = "idx_arc_contact", columnList = "contact_user_id")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AccountRecoveryContact {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;       // the person who might get locked out

    @Column(name = "contact_user_id", nullable = false)
    private UUID contactUserId; // the trusted helper

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Status status = Status.PENDING;

    // AES-256-GCM encrypted TOTP secret — generated when contact accepts the invite.
    // Plain secret is returned once to the contact's device and never stored again.
    @Column(name = "encrypted_totp_secret", length = 512)
    private String encryptedTotpSecret;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public enum Status { PENDING, ACTIVE, REMOVED }
}
