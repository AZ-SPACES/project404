package com.aza.backend.service;

import com.aza.backend.entity.Transaction;
import com.aza.backend.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CategorySuggestionService {

    private final TransactionRepository transactionRepository;

    public record Result(String suggestedCategory, double confidence, String reason) {}

    private static final Map<Transaction.TransactionCategory, List<String>> KEYWORDS;
    static {
        KEYWORDS = new EnumMap<>(Transaction.TransactionCategory.class);
        KEYWORDS.put(Transaction.TransactionCategory.FOOD, List.of(
                "food", "lunch", "dinner", "breakfast", "eat", "restaurant", "meal", "snack",
                "groceries", "waakye", "kenkey", "jollof", "fufu", "rice", "soup", "cook",
                "kfc", "pizza", "chicken", "coffee", "drink", "chop", "bread", "yam", "plantain",
                "suya", "kebab", "shawarma", "canteen", "chop bar"));
        KEYWORDS.put(Transaction.TransactionCategory.TRANSPORT, List.of(
                "uber", "bolt", "taxi", "transport", "ride", "fuel", "trotro", "tro",
                "bus", "car", "petrol", "diesel", "yango", "fare", "vehicle", "lorry",
                "motorbike", "okada", "kweku", "shared ride"));
        KEYWORDS.put(Transaction.TransactionCategory.BILLS, List.of(
                "bill", "utility", "electric", "water", "internet", "wifi", "ecg", "gwcl",
                "mtn", "vodafone", "airtel", "airteltigo", "data", "rent", "subscription",
                "insurance", "dstv", "gotv", "service", "light", "prepaid", "postpaid"));
        KEYWORDS.put(Transaction.TransactionCategory.EDUCATION, List.of(
                "school", "fees", "tuition", "course", "class", "university", "college",
                "knust", "ug", "legon", "book", "textbook", "study", "exam", "registration",
                "admission", "semester", "ait", "polytechnic"));
        KEYWORDS.put(Transaction.TransactionCategory.ENTERTAINMENT, List.of(
                "cinema", "movie", "event", "ticket", "concert", "club", "party", "game",
                "fun", "outing", "bar", "karaoke", "netflix", "streaming", "show"));
        KEYWORDS.put(Transaction.TransactionCategory.SHOPPING, List.of(
                "shop", "buy", "purchase", "mall", "store", "cloth", "shoe", "dress",
                "fashion", "bag", "gift", "market", "oxford street", "jeans", "shirt",
                "jumia", "tonaton", "melcom"));
        KEYWORDS.put(Transaction.TransactionCategory.HEALTHCARE, List.of(
                "hospital", "clinic", "doctor", "medicine", "drug", "pharmacy", "health",
                "medical", "korle", "37", "lister", "dentist", "lab", "test", "check",
                "treatment", "scan", "injection"));
        KEYWORDS.put(Transaction.TransactionCategory.SAVINGS, List.of(
                "save", "savings", "invest", "investment", "emergency", "fund", "stash",
                "piggy", "susu", "njangi"));
    }

    public Result suggest(UUID userId, UUID recipientId, String note, String recipientName) {
        // 1. History-based: most common category sent to this recipient
        List<Transaction> history = transactionRepository.findCompletedDebitsByUserAndRecipient(
                userId, recipientId, PageRequest.of(0, 20));

        if (!history.isEmpty()) {
            Map<Transaction.TransactionCategory, Long> counts = history.stream()
                    .filter(t -> t.getCategory() != null)
                    .collect(Collectors.groupingBy(Transaction::getCategory, Collectors.counting()));

            if (!counts.isEmpty()) {
                var top = counts.entrySet().stream()
                        .max(Map.Entry.comparingByValue()).get();
                double confidence = (double) top.getValue() / history.size();
                if (confidence >= 0.5) {
                    return new Result(top.getKey().name(), confidence, "Based on transaction history");
                }
            }
        }

        // 2. Keyword matching on note + recipient name
        return suggestByKeywords(note, recipientName);
    }

    public Result suggestByKeywords(String note, String recipientName) {
        String combined = ((note != null ? note : "") + " " + (recipientName != null ? recipientName : "")).toLowerCase();
        if (combined.isBlank()) return new Result(null, 0.0, null);

        Transaction.TransactionCategory bestCat = null;
        int bestScore = 0;

        for (Map.Entry<Transaction.TransactionCategory, List<String>> entry : KEYWORDS.entrySet()) {
            int matches = 0;
            for (String kw : entry.getValue()) {
                if (combined.contains(kw)) matches++;
            }
            if (matches > bestScore) {
                bestScore = matches;
                bestCat = entry.getKey();
            }
        }

        if (bestCat != null) {
            double confidence = Math.min(0.40 + (bestScore * 0.15), 0.90);
            return new Result(bestCat.name(), confidence, "Based on note");
        }
        return new Result(null, 0.0, null);
    }
}
