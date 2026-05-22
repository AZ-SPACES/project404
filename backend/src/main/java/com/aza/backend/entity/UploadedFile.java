package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "uploaded_files")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UploadedFile {

    @Id
    @Column(name = "sha256", length = 64)
    private String sha256;

    @Column(nullable = false, length = 1024)
    private String url;

    @Column(nullable = false)
    @Builder.Default
    private Integer referenceCount = 1;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
