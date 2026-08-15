package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * One person's standing place in a {@link RecurringSplit}.
 *
 * Which of the weight columns matters depends on the split's mode, and only one of them
 * is ever read — the same shape the create request takes, kept so a recurring split can
 * produce an ordinary one without a translation layer that could drift from it.
 */
@Entity
@Table(name = "recurring_split_participants",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_recurring_split_participants_split_user",
                columnNames = {"recurringSplitId", "userId"}),
        indexes = @Index(name = "idx_recurring_split_participants_split", columnList = "recurringSplitId"))
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class RecurringSplitParticipant {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID recurringSplitId;

    @Column(nullable = false)
    private UUID userId;

    /** Read for EXACT splits. */
    @Column(precision = 15, scale = 2)
    private BigDecimal amount;

    /** Read for SHARES splits. */
    private Integer shares;

    /** Read for PERCENTAGE splits. */
    @Column(precision = 5, scale = 2)
    private BigDecimal percentage;
}
