package com.aza.backend.service;

import com.aza.backend.dto.ai.AiUsageOverview;
import com.aza.backend.dto.ai.AiUsageUserRow;
import com.aza.backend.entity.AiUsageLog;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.AiUsageLogRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.util.RateLimitService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Records AI/LLM usage (metadata only — never prompt text) and serves the admin
 * AI-usage view: volume, cost/abuse signals, and a coarse keyword topic so admins
 * can see what the assistant is used for without storing financial PII.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiUsageService {

    private final AiUsageLogRepository repository;
    private final UserRepository userRepository;
    private final RateLimitService rateLimitService;

    // Ordered keyword buckets — first match wins. Anything that matches none is "OTHER",
    // which doubles as a rough off-topic signal for the misuse view.
    private static final List<Map.Entry<String, List<String>>> TOPIC_KEYWORDS = List.of(
            Map.entry("BALANCE", List.of("balance", "how much", "available", "wallet")),
            Map.entry("SPENDING", List.of("spent", "spending", "expense", "where did my money", "outgoing")),
            Map.entry("BUDGET", List.of("budget", "save", "saving", "goal", "limit", "afford")),
            Map.entry("TRANSFER", List.of("send", "transfer", "pay ", "payment", "recipient", "received", "withdraw")),
            Map.entry("FEES", List.of("fee", "charge", "cost", "rate")),
            Map.entry("ACCOUNT", List.of("account", "pin", "password", "kyc", "verify", "login", "card", "limit raise"))
    );

    /** Best-effort: a failed write must never break the AI call itself. */
    public void record(UUID userId, String endpoint, String model, int msgLen, String topic, boolean blocked) {
        try {
            repository.save(AiUsageLog.builder()
                    .userId(userId)
                    .endpoint(endpoint)
                    .model(model)
                    .msgLen(msgLen)
                    .topic(topic)
                    .blocked(blocked)
                    .build());
        } catch (Exception e) {
            log.warn("Failed to record AI usage for user {}: {}", userId, e.getMessage());
        }
    }

    /** Coarse, keyword-derived topic bucket. Returns "OTHER" when nothing finance-related matches. */
    public String classifyTopic(String message) {
        if (message == null || message.isBlank()) return "OTHER";
        String lower = message.toLowerCase();
        for (Map.Entry<String, List<String>> bucket : TOPIC_KEYWORDS) {
            for (String kw : bucket.getValue()) {
                if (lower.contains(kw)) return bucket.getKey();
            }
        }
        return "OTHER";
    }

    public AiUsageOverview getOverview(int days) {
        LocalDateTime since = LocalDateTime.now().minusDays(days);

        long total = repository.countByCreatedAtAfter(since);
        long blocked = repository.countByBlockedTrueAndCreatedAtAfter(since);
        long uniqueUsers = repository.countDistinctUsersSince(since);

        List<AiUsageOverview.Count> byEndpoint = repository.countByEndpointSince(since).stream()
                .map(r -> new AiUsageOverview.Count((String) r[0], longVal(r[1])))
                .toList();

        List<AiUsageOverview.Count> byTopic = repository.countByTopicSince(since).stream()
                .map(r -> new AiUsageOverview.Count((String) r[0], longVal(r[1])))
                .toList();

        List<AiUsageOverview.Daily> daily = repository.dailyVolumeSince(since).stream()
                .map(r -> new AiUsageOverview.Daily(String.valueOf(r[0]), longVal(r[1])))
                .toList();

        return new AiUsageOverview(total, blocked, uniqueUsers, byEndpoint, byTopic, daily);
    }

    /** Admin kill switch: enable/disable the AI assistant for a user. Returns the updated user. */
    public User setAiDisabled(UUID userId, boolean disabled) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));
        user.setAiDisabled(disabled);
        return userRepository.save(user);
    }

    /** Admin override: clear a user's hourly + daily AI quota counters. */
    public void resetQuota(UUID userId) {
        if (!userRepository.existsById(userId)) {
            throw new AppException("NOT_FOUND", "User not found", HttpStatus.NOT_FOUND);
        }
        rateLimitService.resetAiQuota(userId);
    }

    public List<AiUsageUserRow> getTopUsers(int days, int limit) {
        LocalDateTime since = LocalDateTime.now().minusDays(days);
        List<Object[]> rows = repository.topUsersSince(since, Math.min(limit, 200));
        if (rows.isEmpty()) return List.of();

        List<UUID> ids = rows.stream().map(r -> toUuid(r[0])).toList();
        Map<UUID, User> users = userRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        List<AiUsageUserRow> result = new ArrayList<>();
        for (Object[] r : rows) {
            UUID userId = toUuid(r[0]);
            User u = users.get(userId);
            String name = u != null
                    ? ((u.getFirstName() == null ? "" : u.getFirstName()) + " "
                       + (u.getLastName() == null ? "" : u.getLastName())).trim()
                    : "Unknown";
            result.add(new AiUsageUserRow(
                    userId,
                    name.isBlank() ? "Unknown" : name,
                    u != null ? u.getUsername() : null,
                    longVal(r[1]),
                    longVal(r[2]),
                    longVal(r[3]),
                    r[4] instanceof Timestamp ts ? ts.toLocalDateTime() : null,
                    u != null && u.isAiDisabled()));
        }
        return result;
    }

    private static long longVal(Object o) {
        return o instanceof Number n ? n.longValue() : 0L;
    }

    private static UUID toUuid(Object o) {
        return o instanceof UUID u ? u : UUID.fromString(o.toString());
    }
}
