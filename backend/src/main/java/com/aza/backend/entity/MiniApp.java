package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
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

    public enum Permission {
        USER_PROFILE,       // first name, username, avatar
        USER_PHONE,         // phone number
        USER_EMAIL,         // email address
        MAKE_PAYMENTS,      // initiate Aza payments from user wallet
        READ_BALANCE,       // view wallet balance
        READ_TRANSACTIONS   // view recent transaction history
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

    /** Marketing screenshots (HTTPS image URLs) shown to admins during review. */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "mini_app_screenshots",
            joinColumns = @JoinColumn(name = "app_id"))
    @OrderColumn(name = "position")
    @Column(name = "url", columnDefinition = "TEXT")
    @Builder.Default
    private List<String> screenshotUrls = new ArrayList<>();

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
}
