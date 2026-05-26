package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "merchant_invoices")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class MerchantInvoice {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID merchantId;

    @Column(unique = true, nullable = false, length = 30)
    private String referenceId; // e.g. INV-2024-001

    @Column(nullable = false)
    private String customerName;

    private String customerEmail;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    @Builder.Default
    private String currency = "GHS";

    @Column(columnDefinition = "TEXT")
    private String description;

    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private InvoiceStatus status = InvoiceStatus.DRAFT;

    private UUID checkoutSessionId; // set when invoice is sent/paid via checkout

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime sentAt;
    private LocalDateTime paidAt;

    public enum InvoiceStatus { DRAFT, SENT, PAID, OVERDUE, CANCELLED }
}
