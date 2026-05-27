package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "bulk_transfer_items")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class BulkTransferItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID bulkTransferId;

    @Column(nullable = false)
    private String recipientIdentifier;

    private UUID recipientUserId;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    private String note;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private BulkTransferItemStatus status = BulkTransferItemStatus.PENDING;

    private String failureReason;

    private LocalDateTime processedAt;

    public enum BulkTransferItemStatus {
        PENDING, COMPLETED, FAILED
    }
}
