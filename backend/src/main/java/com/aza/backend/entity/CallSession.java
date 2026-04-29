package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;


@Entity
@Table(name = "call_sessions")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class CallSession {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID callerId;

    @Column(nullable = false)
    private UUID calleeId;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private CallType type = CallType.VOICE;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private CallStatus status = CallStatus.INITIATING;

    @CreationTimestamp
    private LocalDateTime initiatedAt;

    private LocalDateTime answeredAt;
    private LocalDateTime endedAt;

    // Duration in seconds (set when call ends)
    private Integer durationSeconds;

    // Video upgrade — set when one participant requests to switch VOICE → VIDEO
    @Builder.Default
    private Boolean upgradeRequested = false;

    private UUID upgradeRequestedBy; // userId who initiated the upgrade

    public enum CallType {
        VOICE, VIDEO
    }

    public enum CallStatus {
        INITIATING,    // caller sent invite, waiting for callee
        RINGING,       // callee received the invite
        ACTIVE,        // call accepted, WebRTC connected
        RECONNECTING,  // ICE failure detected; both sides attempting ICE restart
        ENDED,         // call ended normally
        DECLINED,      // callee declined
        MISSED,        // callee didn't answer in 30s
        FAILED         // technical failure
    }
}
