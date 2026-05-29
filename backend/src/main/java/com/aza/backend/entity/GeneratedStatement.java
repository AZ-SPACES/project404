package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "generated_statements",
       indexes = @Index(name = "idx_stmt_verify_code", columnList = "verifyCode", unique = true))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class GeneratedStatement {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 64)
    private String verifyCode;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String accountHolderName;

    @Column(nullable = false)
    private String accountNumber;

    @Column(nullable = false)
    private LocalDateTime periodStart;

    @Column(nullable = false)
    private LocalDateTime periodEnd;

    @Column(nullable = false)
    private int transactionCount;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal openingBalance;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal totalCredits;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal totalDebits;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal closingBalance;

    @CreationTimestamp
    private LocalDateTime generatedAt;
}
