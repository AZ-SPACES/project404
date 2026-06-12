package com.aza.backend.service;

import com.aza.backend.entity.RiskDecisionLog;
import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.RiskDecisionLogRepository;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Claude-powered second opinion on held transfers. Not a replacement for the
 * heuristic scorer or the human decision — a reasoning layer COMPLIANCE can
 * consult on demand. The verdict and reasoning are stored on the decision log,
 * so once enough human labels accumulate we can also measure how well the LLM
 * judge agrees with human reviewers before trusting it further.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FraudAiService {

    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;
    private final RiskDecisionLogRepository decisionLogRepository;
    private final ObjectMapper objectMapper;

    @Value("${anthropic.api-key:}")
    private String apiKey;

    @Value("${anthropic.fraud-model:claude-opus-4-8}")
    private String model;

    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private static final String SYSTEM_PROMPT = """
            You are a fraud analyst for AZA, a Ghanaian mobile-money platform. You review \
            transfers that were automatically held because they scored HIGH on behavioral \
            anomaly checks. Account-takeover fraud (stolen credentials draining a wallet to \
            a mule account) is the primary threat; the main cost of a wrong call is either \
            a customer's stolen money leaving (false release) or a legitimate customer being \
            blocked (false rejection).

            Respond with strict JSON only, no markdown fences, in exactly this shape:
            {"verdict": "LIKELY_FRAUD" | "LIKELY_LEGITIMATE" | "UNCERTAIN", "confidence": 0-100, "reasoning": "<3-5 sentences a compliance officer can act on>"}""";

    public record Assessment(String verdict, int confidence, String reasoning) {}

    public Assessment assessHeldTransfer(UUID transactionId) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new AppException("AI_UNAVAILABLE", "ANTHROPIC_API_KEY is not configured", HttpStatus.SERVICE_UNAVAILABLE);
        }
        Transaction tx = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Transaction not found", HttpStatus.NOT_FOUND));
        User sender = userRepository.findById(tx.getSenderId())
                .orElseThrow(() -> new AppException("Sender not found"));
        User recipient = userRepository.findById(tx.getRecipientId()).orElse(null);

        Assessment assessment = callClaude(buildContext(tx, sender, recipient));

        decisionLogRepository.findByTransactionId(transactionId).ifPresent(entry -> {
            entry.setAiVerdict(assessment.verdict());
            entry.setAiReasoning(assessment.reasoning());
            decisionLogRepository.save(entry);
        });
        return assessment;
    }

    private String buildContext(Transaction tx, User sender, User recipient) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime ninetyDaysAgo = now.minusDays(90);

        long priorSendsToRecipient = transactionRepository
                .countCompletedDebitsByUserAndRecipient(sender.getId(), tx.getRecipientId());
        long sendsLast90d = transactionRepository.countCompletedDebitsByUser(sender.getId(), ninetyDaysAgo);
        BigDecimal avgAmount = transactionRepository.getAverageAmountByUser(sender.getId(), ninetyDaysAgo);
        BigDecimal maxAmount = transactionRepository.getMaxAmountByUser(sender.getId(), ninetyDaysAgo);
        long sendsLastHour = transactionRepository.countCompletedDebitsByUser(sender.getId(), now.minusHours(1));
        long accountAgeDays = sender.getCreatedAt() != null
                ? ChronoUnit.DAYS.between(sender.getCreatedAt(), now) : -1;
        long recipientAgeDays = recipient != null && recipient.getCreatedAt() != null
                ? ChronoUnit.DAYS.between(recipient.getCreatedAt(), now) : -1;

        return """
                Held transfer under review:
                - Amount: GHS %s
                - Initiated: %s (hour of day: %d)
                - Note attached: %s
                - Anomaly score: %s (risk level %s)

                Sender profile:
                - Account age: %d days, KYC status: %s
                - Transfers sent in last 90 days: %d (average GHS %s, maximum GHS %s)
                - Transfers sent in the last hour: %d
                - Prior transfers to this specific recipient: %d

                Recipient profile:
                - Account age: %d days, KYC status: %s

                Assess whether this looks like account-takeover fraud or legitimate but unusual behavior.""".formatted(
                tx.getAmount().toPlainString(),
                tx.getInitiatedAt(),
                tx.getInitiatedAt() != null ? tx.getInitiatedAt().getHour() : -1,
                tx.getNote() != null && !tx.getNote().isBlank() ? "\"" + tx.getNote() + "\"" : "none",
                tx.getAnomalyScore(),
                tx.getAnomalyRiskLevel(),
                accountAgeDays,
                sender.getKycStatus(),
                sendsLast90d,
                avgAmount != null ? avgAmount.toPlainString() : "0",
                maxAmount != null ? maxAmount.toPlainString() : "0",
                sendsLastHour,
                priorSendsToRecipient,
                recipientAgeDays,
                recipient != null ? recipient.getKycStatus() : "unknown");
    }

    private Assessment callClaude(String context) {
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("model", model);
            body.put("max_tokens", 16000);
            body.put("thinking", Map.of("type", "adaptive"));
            body.put("system", SYSTEM_PROMPT);
            body.put("messages", List.of(Map.of("role", "user", "content", context)));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.anthropic.com/v1/messages"))
                    .timeout(Duration.ofSeconds(120))
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", "2023-06-01")
                    .header("content-type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                    .build();

            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                log.warn("Anthropic API returned {} for fraud assessment: {}", response.statusCode(), response.body());
                throw new AppException("AI_ERROR", "AI assessment failed (HTTP " + response.statusCode() + ")",
                        HttpStatus.BAD_GATEWAY);
            }

            JsonNode root = objectMapper.readTree(response.body());
            String text = null;
            for (JsonNode block : root.path("content")) {
                if ("text".equals(block.path("type").asText())) {
                    text = block.path("text").asText();
                    break;
                }
            }
            if (text == null || text.isBlank()) {
                throw new AppException("AI_ERROR", "AI returned no assessment", HttpStatus.BAD_GATEWAY);
            }
            return parseAssessment(text);
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            log.error("Fraud AI assessment failed: {}", e.getMessage());
            throw new AppException("AI_ERROR", "AI assessment failed: " + e.getMessage(), HttpStatus.BAD_GATEWAY);
        }
    }

    private Assessment parseAssessment(String text) throws Exception {
        // Defensive: strip markdown fences if the model adds them despite instructions
        String json = text.trim();
        if (json.startsWith("```")) {
            json = json.replaceAll("^```(json)?\\s*", "").replaceAll("```\\s*$", "").trim();
        }
        JsonNode node = objectMapper.readTree(json);
        return new Assessment(
                node.path("verdict").asText("UNCERTAIN"),
                node.path("confidence").asInt(0),
                node.path("reasoning").asText(""));
    }
}
