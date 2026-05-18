package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "system_settings")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class SystemSetting {

    @Id
    @Column(nullable = false, length = 100)
    private String key;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String value;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
