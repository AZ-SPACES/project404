package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "user_withdrawals")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserWithdrawal {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 10)
    @Builder.Default
    private String currency = "GHS";

    @Column(nullable = false, length = 50)
    private String provider;

    @Column(nullable = false, length = 100)
    private String destination;

    @Column(length = 100)
    private String bankName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    private WithdrawalStatus status = WithdrawalStatus.PENDING;

    @Column(columnDefinition = "TEXT")
    private String adminNote;

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime reviewedAt;
    private UUID reviewedBy;

    public enum WithdrawalStatus {
        PENDING, APPROVED, REJECTED, COMPLETED
    }
}
