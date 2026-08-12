package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "mini_apps")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class MiniApp {

    public enum Status {
        DRAFT,          // saved but not yet submitted
        PENDING_REVIEW, // submitted, awaiting admin
        ACTIVE,         // approved — visible in hub
        REJECTED,       // rejected; developer sees reason and can resubmit
        SUSPENDED       // pulled by admin after going live
    }

    public enum HostingMode {
        /** Developer hosts the build themselves; {@code url} is whatever they submitted. */
        EXTERNAL,
        /** Developer uploaded a static bundle; Aza serves it from its own origin. */
        AZA_HOSTED
    }

    public enum Permission {
        USER_PROFILE,       // first name, username, avatar
        USER_PHONE,         // phone number
        USER_EMAIL,         // email address
        MAKE_PAYMENTS,      // initiate Aza payments from user wallet
        READ_BALANCE,       // view wallet balance
        READ_TRANSACTIONS,  // view recent transaction history
        DIRECT_DEBIT        // charge a standing mandate on the user's wallet with no per-charge passcode
    }

    @Id
    @Column(length = 100)
    private String id; // developer-chosen slug e.g. "bolt_ghana"

    @Column(nullable = false, length = 255)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 50)
    private String category;

    @Column(columnDefinition = "TEXT")
    private String iconUrl;

    /** The URL the hub WebView loads. */
    @Column(columnDefinition = "TEXT", nullable = false)
    private String url;

    /** Short URL shown to users on the consent sheet. */
    @Column(length = 255)
    private String developerName;

    @Column(length = 255)
    private String supportUrl;

    @Column(length = 20)
    private String version;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.DRAFT;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "mini_app_permissions",
            joinColumns = @JoinColumn(name = "app_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "permission", length = 30)
    @Builder.Default
    private Set<Permission> requestedPermissions = new LinkedHashSet<>();

    /** Aza user ID of the developer who submitted this app. */
    @Column(nullable = false)
    private UUID submittedBy;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    private LocalDateTime submittedAt;

    private UUID reviewedBy;
    private LocalDateTime reviewedAt;

    @Column(columnDefinition = "TEXT")
    private String rejectionReason;

    // ── Hosting ────────────────────────────────────────────────────────────────

    @Enumerated(EnumType.STRING)
    @Column(name = "hosting_mode", nullable = false, length = 20)
    @Builder.Default
    private HostingMode hostingMode = HostingMode.EXTERNAL;

    /**
     * DNS label this app is served from when {@link HostingMode#AZA_HOSTED}, e.g.
     * {@code bolt-ghana} → {@code bolt-ghana.miniapps.aza.systems}. Derived from
     * {@link #id} rather than reused directly, because ids permit underscores and
     * hostnames do not. Null for EXTERNAL apps.
     */
    @Column(length = 63)
    private String subdomain;

    /** Bundle version currently symlinked to {@code current} and served to users. */
    @Column(length = 40)
    private String bundleVersion;

    /** Uploaded, awaiting review. Promoted to {@link #bundleVersion} on approval. */
    @Column(length = 40)
    private String pendingBundleVersion;

    private Long bundleSizeBytes;

    private LocalDateTime bundleUploadedAt;
}
