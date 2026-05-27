package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "bulk_transfers")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class BulkTransfer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID merchantId;

    private String note;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal totalAmount;

    @Column(nullable = false)
    private int recipientCount;

    @Builder.Default
    private int successCount = 0;

    @Builder.Default
    private int failureCount = 0;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private BulkTransferStatus status = BulkTransferStatus.PENDING;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime processedAt;

    public enum BulkTransferStatus {
        PENDING, PROCESSING, COMPLETED, PARTIALLY_COMPLETED, FAILED
    }
}
