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

    @Id
    @Column(length = 100)
    private String appId;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(nullable = false)
    private UUID disabledBy;

    @CreationTimestamp
    private LocalDateTime disabledAt;
}
