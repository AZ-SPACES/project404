package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "audit_logs", indexes = {
    @Index(name = "idx_audit_user",       columnList = "user_id"),
    @Index(name = "idx_audit_event_type", columnList = "event_type"),
    @Index(name = "idx_audit_created_at", columnList = "created_at")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    private UUID userId;
    private String userEmail;

    @Column(nullable = false, length = 100)
    private String eventType;

    /** "SUCCESS" or "FAILURE" */
    @Column(nullable = false, length = 10)
    private String outcome;

    @Column(length = 45)
    private String ipAddress;

    private String deviceId;

    private UUID resourceId;

    @Column(length = 50)
    private String resourceType;

    /** JSON blob with event-specific context. */
    @Column(columnDefinition = "TEXT")
    private String details;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    // ── Event type constants ──────────────────────────────────────────────────

    public static final String AUTH_SIGNUP              = "AUTH_SIGNUP";
    public static final String AUTH_LOGIN_SUCCESS       = "AUTH_LOGIN_SUCCESS";
    public static final String AUTH_LOGIN_FAILURE       = "AUTH_LOGIN_FAILURE";
    public static final String AUTH_LOGOUT              = "AUTH_LOGOUT";
    public static final String AUTH_LOGOUT_EVERYWHERE   = "AUTH_LOGOUT_EVERYWHERE";
    public static final String AUTH_PASSWORD_CHANGE     = "AUTH_PASSWORD_CHANGE";
    public static final String AUTH_PASSCODE_SET        = "AUTH_PASSCODE_SET";
    public static final String AUTH_2FA_ENABLED         = "AUTH_2FA_ENABLED";
    public static final String AUTH_2FA_DISABLED        = "AUTH_2FA_DISABLED";
    public static final String AUTH_BIOMETRIC_ENROLLED  = "AUTH_BIOMETRIC_ENROLLED";
    public static final String TRANSFER_COMPLETED       = "TRANSFER_COMPLETED";
    public static final String TRANSFER_FAILED          = "TRANSFER_FAILED";
    public static final String WALLET_FROZEN            = "WALLET_FROZEN";
    public static final String WALLET_UNFROZEN          = "WALLET_UNFROZEN";
    public static final String ACCOUNT_SUSPENDED        = "ACCOUNT_SUSPENDED";
    public static final String ACCOUNT_REACTIVATED      = "ACCOUNT_REACTIVATED";
    public static final String PASSCODE_VERIFY_FAILURE  = "PASSCODE_VERIFY_FAILURE";

    public static final String SUCCESS = "SUCCESS";
    public static final String FAILURE = "FAILURE";
}
