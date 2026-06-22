package com.aza.backend.dto.ai;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Per-user AI-usage rollup for the top-users / abuse-alert table.
 * {@code blockedCalls} (repeated quota hits) and {@code otherTopicCalls} (off-finance
 * questions) are the misuse signals an admin scans for.
 */
public record AiUsageUserRow(
        UUID userId,
        String name,
        String username,
        long totalCalls,
        long blockedCalls,
        long otherTopicCalls,
        LocalDateTime lastUsedAt,
        boolean aiDisabled) {}
