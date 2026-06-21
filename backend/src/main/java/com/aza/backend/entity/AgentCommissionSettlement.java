package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A payout of the commission AZA owes an agent. Commission accrues as a payable on
 * {@link Agent#getCommissionAccruedGhs()} and is paid out of band via the bank; this
 * row records that payout and the accrual is reduced by the same amount. No e-money is
 * created or moved, so the safeguarding invariant is unaffected.
 */
@Entity
@Table(name = "agent_commission_settlements")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class AgentCommissionSettlement {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID agentId;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal amount;

    /** Bank reference for the payout, tying it to the disbursement statement line. */
    @Column(length = 255)
    private String bankReference;

    /** userId of the staff member who executed (approved) the settlement. */
    private UUID performedBy;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
