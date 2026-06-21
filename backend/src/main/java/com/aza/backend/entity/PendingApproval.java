package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Maker-checker: a sensitive admin action waiting for a second staff member.
 * The initiator's request is captured (action + JSON payload) and only executed
 * when a different, suitably-roled staff member approves it.
 */
@Entity
@Table(name = "pending_approvals")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PendingApproval {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private ActionType actionType;

    /** What the action operates on: transaction id, fee rule id, or user id. */
    @Column(nullable = false)
    private UUID targetId;

    /** JSON-serialized request body, replayed on approval. Null for parameterless actions. */
    @Column(columnDefinition = "TEXT")
    private String payload;

    /** Human-readable description shown in the approval queue. */
    @Column(nullable = false, length = 500)
    private String summary;

    @Column(nullable = false)
    private UUID requestedBy;

    private String requestedByEmail;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime requestedAt;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false, length = 20)
    private Status status = Status.PENDING;

    private UUID reviewedBy;
    private String reviewedByEmail;
    private LocalDateTime reviewedAt;

    @Column(length = 1000)
    private String reviewNotes;

    public enum ActionType {
        REVERSE_TRANSACTION,    // approver needs FINANCE
        UPDATE_FEE_RULE,        // approver needs FINANCE
        UPDATE_USER_LIMITS,     // approver needs COMPLIANCE
        GRANT_STAFF_ROLE,       // approver needs ADMIN
        CHANGE_STAFF_ROLE,      // approver needs ADMIN
        UPDATE_SYSTEM_SETTINGS, // approver needs ADMIN
        UNFREEZE_WALLET,        // approver needs FINANCE (freezing stays immediate)
        REACTIVATE_USER,        // approver needs COMPLIANCE (suspending stays immediate)
        APPROVE_KYC,            // approver needs COMPLIANCE (rejecting stays immediate)
        BROADCAST_NOTIFICATION, // approver needs ADMIN
        ENABLE_MINI_APP,        // approver needs ADMIN (kill switch stays immediate)
        APPROVE_AGENT,          // approver needs COMPLIANCE (rejecting/suspending stays immediate)
        MINT_FLOAT,             // approver needs FINANCE (creates e-money against a bank deposit)
        BURN_FLOAT,             // approver needs FINANCE (destroys e-money as bank money is wired out)
        APPROVE_WITHDRAWAL,     // approver needs FINANCE (rejection/refund stays immediate)
        SETTLE_COMMISSION       // approver needs FINANCE (pays an agent's accrued commission out of band)
    }

    public enum Status {
        PENDING, APPROVED, REJECTED, EXPIRED
    }
}
