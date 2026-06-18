package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "kyb_documents")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class KybDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID merchantId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DocumentType type;

    private String fileName;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String cloudinaryUrl;

    private String cloudinaryPublicId;
    private Long fileSizeBytes;
    private String mimeType;

    @CreationTimestamp
    private LocalDateTime uploadedAt;

    public enum DocumentType {
        CERTIFICATE_OF_INCORPORATION,
        BUSINESS_REGISTRATION,
        TAX_CERTIFICATE,
        UTILITY_BILL,
        PROOF_OF_ADDRESS,
        OWNER_ID_FRONT,
        OWNER_ID_BACK,
        BANK_STATEMENT,
        OTHER
    }
}
