package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "merchant_notification_preferences")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class MerchantNotificationPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private UUID merchantId;

    @Builder.Default private boolean emailPaymentReceived = true;
    @Builder.Default private boolean emailDisputeOpened = true;
    @Builder.Default private boolean emailPayoutCompleted = true;
    @Builder.Default private boolean emailPayoutFailed = true;
    @Builder.Default private boolean emailInvoicePaid = true;
    @Builder.Default private boolean emailWeeklySummary = true;
    @Builder.Default private boolean emailApiKeyCreated = false;
    @Builder.Default private boolean emailLowBalance = false;

    @Column(precision = 15, scale = 2)
    private BigDecimal lowBalanceThreshold;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
