package com.aza.backend.service;

import com.aza.backend.dto.ai.AiChatMessage;
import com.aza.backend.dto.transfer.FinancialSummaryResponse;
import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.User;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.Date;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiService {

    private final TransferService transferService;
    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Value("${anthropic.api-key:}")
    private String apiKey;

    @Value("${anthropic.model:claude-sonnet-4-6}")
    private String model;

    @Value("${chatbase.identity-secret:}")
    private String chatbaseSecret;

    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .build();

    public String generateTransferInsight(UUID userId, UUID transactionId) {
        if (apiKey == null || apiKey.isBlank()) return null;

        Transaction tx = transactionRepository.findById(transactionId).orElse(null);
        if (tx == null || !tx.getSenderId().equals(userId)) return null;

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime monthStart = now.minusDays(30);

        FinancialSummaryResponse summary;
        Map<String, Object> catData;
        try {
            summary = transferService.getFinancialSummary(userId, monthStart, now);
            catData = transferService.getSpendingCategories(userId, monthStart, now);
        } catch (Exception e) {
            log.warn("Failed to load financial context for insight: {}", e.getMessage());
            return null;
        }

        String recipientName = userRepository.findById(tx.getRecipientId())
                .map(u -> u.getFirstName() + " " + u.getLastName())
                .orElse("the recipient");

        String categoryName = tx.getCategory() != null
                ? tx.getCategory().name()
                : "OTHERS";

        String catSummary = buildCatSummary(catData);

        String prompt = String.format(
                "User sent GHS %.2f to %s (category: %s).%n%nTheir last 30 days:%n- Spent: GHS %.2f | Received: GHS %.2f | Balance: GHS %.2f%n- Categories: %s%n%nWrite one friendly, specific insight about this transfer in context of their spending (max 110 characters). No bullet points.",
                tx.getAmount().doubleValue(),
                recipientName,
                categoryName,
                summary.getTotalSpent().doubleValue(),
                summary.getTotalIncome().doubleValue(),
                summary.getBalance().doubleValue(),
                catSummary
        );

        return callClaude(
                "You are a financial assistant for AZA, a payment app in Ghana (GHS). Be encouraging and concise.",
                List.of(Map.of("role", "user", "content", prompt)),
                120
        );
    }

    public String chat(UUID userId, String message, List<AiChatMessage> history) {
        if (apiKey == null || apiKey.isBlank()) return null;

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime monthStart = LocalDate.now().withDayOfMonth(1).atStartOfDay();

        FinancialSummaryResponse summary;
        Map<String, Object> catData;
        try {
            summary = transferService.getFinancialSummary(userId, monthStart, now);
            catData = transferService.getSpendingCategories(userId, monthStart, now);
        } catch (Exception e) {
            log.warn("Failed to load financial context for chat: {}", e.getMessage());
            return null;
        }

        String catSummary = buildCatSummary(catData);

        String systemPrompt = String.format(
                """
                You are Aza AI, a friendly financial assistant inside the AZA payment app for Ghana.

                User's finances this month:
                - Balance: GHS %.2f
                - Income: GHS %.2f
                - Spent: GHS %.2f
                - Net: GHS %.2f
                - Spending breakdown: %s

                Keep answers under 100 words unless more detail is genuinely needed. Use GHS for amounts. Be helpful and encouraging.""",
                summary.getBalance().doubleValue(),
                summary.getTotalIncome().doubleValue(),
                summary.getTotalSpent().doubleValue(),
                summary.getNetChange().doubleValue(),
                catSummary
        );

        List<Map<String, String>> messages = new ArrayList<>();
        if (history != null) {
            // Cap history to the 20 most-recent exchanges and whitelist roles so a client
            // cannot inject a "system" role to override the system prompt.
            history.stream()
                    .filter(msg -> msg != null && msg.getContent() != null && !msg.getContent().isBlank())
                    .filter(msg -> "user".equals(msg.getRole()) || "assistant".equals(msg.getRole()))
                    .limit(20)
                    .forEach(msg -> messages.add(Map.of("role", msg.getRole(),
                            "content", msg.getContent().substring(0, Math.min(msg.getContent().length(), 2000)))));
        }
        messages.add(Map.of("role", "user", "content", message.substring(0, Math.min(message.length(), 2000))));

        return callClaude(systemPrompt, messages, 400);
    }

    public String supportBotReply(String userContext, List<Map<String, String>> history, int maxTokens) {
        if (apiKey == null || apiKey.isBlank()) return null;
        String system = """
                You are Aza AI, AZA's friendly and professional customer support assistant.
                AZA is a peer-to-peer payment app used in Ghana (GHS currency).

                Respond ONLY with valid JSON in this exact format:
                {"reply": "your response here", "escalate": false}

                Set escalate=true ONLY when: user reports fraud, unauthorized access, account locked,
                urgent account issues, or asks to speak to a human. Be concise (under 80 words).

                """ + userContext;
        return callClaude(system, history, maxTokens);
    }

    public String generateChatbaseToken(UUID userId, String email) {
        if (chatbaseSecret == null || chatbaseSecret.isBlank()) return null;
        try {
            Date now = new Date();
            Date expiry = new Date(now.getTime() + 3_600_000L);
            SecretKey key = Keys.hmacShaKeyFor(chatbaseSecret.getBytes(StandardCharsets.UTF_8));
            return Jwts.builder()
                    .claim("user_id", userId.toString())
                    .claim("email", email)
                    .issuedAt(now)
                    .expiration(expiry)
                    .signWith(key)
                    .compact();
        } catch (Exception e) {
            log.warn("Failed to generate Chatbase token: {}", e.getMessage());
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private String buildCatSummary(Map<String, Object> catData) {
        List<Map<String, Object>> cats = (List<Map<String, Object>>) catData.get("categories");
        if (cats == null || cats.isEmpty()) return "no spending";
        StringBuilder sb = new StringBuilder();
        for (Map<String, Object> cat : cats) {
            if (!sb.isEmpty()) sb.append(", ");
            sb.append(cat.get("name")).append(" GHS ").append(
                    String.format("%.2f", ((BigDecimal) cat.get("total")).doubleValue()));
        }
        return sb.toString();
    }

    private String callClaude(String systemPrompt, List<Map<String, String>> messages, int maxTokens) {
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("model", model);
            body.put("max_tokens", maxTokens);
            body.put("system", systemPrompt);
            body.put("messages", messages);

            String requestJson = objectMapper.writeValueAsString(body);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.anthropic.com/v1/messages"))
                    .timeout(Duration.ofSeconds(60))
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", "2023-06-01")
                    .header("content-type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestJson))
                    .build();

            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.warn("Anthropic API returned {}: {}", response.statusCode(), response.body());
                return null;
            }

            JsonNode root = objectMapper.readTree(response.body());
            for (JsonNode block : root.path("content")) {
                if ("text".equals(block.path("type").asText())) {
                    return block.path("text").asText(null);
                }
            }
            return null;
        } catch (Exception e) {
            log.warn("Anthropic API call failed: {}", e.getMessage());
            return null;
        }
    }
}
