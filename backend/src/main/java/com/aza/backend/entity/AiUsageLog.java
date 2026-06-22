package com.aza.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * One row per AI/LLM call (or quota-blocked attempt). Metadata only — we deliberately
 * never store the prompt or reply text, since chat content can contain financial PII.
 * Powers the admin AI-usage view: volume, cost/abuse monitoring, and (via {@link #topic})
 * a privacy-safe sense of what the assistant is used for.
 */
@Entity
@Table(name = "ai_usage_log")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class AiUsageLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    /** Which surface the call came from: "chat", "insight", or "support". */
    @Column(nullable = false, length = 20)
    private String endpoint;

    /** The Gemini model used (null for blocked attempts that never reached the API). */
    @Column(length = 60)
    private String model;

    /** Length of the user's message in characters (0 when there is no free-text input). */
    @Column(nullable = false)
    private Integer msgLen;

    /** Coarse, keyword-derived topic bucket (e.g. BALANCE, BUDGET, OTHER). No raw text. */
    @Column(length = 30)
    private String topic;

    /** True when the call was denied because the user hit their per-user AI quota. */
    @Column(nullable = false)
    private boolean blocked;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
