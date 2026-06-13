package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "disabled_mini_apps")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class DisabledMiniApp {

    public enum Status {
        /** Kill switch: hidden from the hub entirely. */
        DISABLED,
        /** Temporarily down: shown greyed-out with a maintenance notice. */
        MAINTENANCE
    }

    @Id
    @Column(length = 100)
    private String appId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private Status status = Status.DISABLED;

    /** Internal note for DISABLED; user-facing message for MAINTENANCE. */
    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(nullable = false)
    private UUID disabledBy;

    @CreationTimestamp
    private LocalDateTime disabledAt;
}
