package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A mint or burn of agent float. MINT creates e-money in the agent's wallet against
 * a verified bank deposit; BURN removes it when bank money is wired out. The bank
 * reference ties the movement to the safeguarded-account statement line.
 */
@Entity
@Table(name = "float_movements")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class FloatMovement {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID agentId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Type type;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal amount;

    @Column(length = 255)
    private String bankReference;

    /** userId of the staff member who executed (approved) the movement. */
    private UUID performedBy;

    @CreationTimestamp
    private LocalDateTime createdAt;

    public enum Type { MINT, BURN }
}
