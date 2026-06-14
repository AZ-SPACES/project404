package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.WebhookDelivery;
import com.aza.backend.repository.RefreshTokenRepository;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.WebhookDeliveryRepository;
import com.aza.backend.service.AdminAnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/admin/analytics")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
public class AdminAnalyticsController {

    private final AdminAnalyticsService adminAnalyticsService;
    private final WebhookDeliveryRepository webhookDeliveryRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final TransactionRepository transactionRepository;

    @GetMapping("/cohorts")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getCohorts(
            @RequestParam(defaultValue = "6") int months) {
        return ResponseEntity.ok(ApiResponse.success(adminAnalyticsService.getCohortRetention(months)));
    }

    @GetMapping("/revenue")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getRevenue(
            @RequestParam(defaultValue = "12") int months) {
        return ResponseEntity.ok(ApiResponse.success(adminAnalyticsService.getRevenueDashboard(months)));
    }

    /** Webhook delivery analytics: success/failure rates by event type. */
    @GetMapping("/webhooks")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getWebhookAnalytics() {
        List<WebhookDelivery> all = webhookDeliveryRepository.findAll();

        long total = all.size();
        long delivered = all.stream()
                .filter(d -> d.getStatus() == WebhookDelivery.DeliveryStatus.SUCCESS).count();
        long failed = all.stream()
                .filter(d -> d.getStatus() == WebhookDelivery.DeliveryStatus.FAILED).count();
        long pending = all.stream()
                .filter(d -> d.getStatus() == WebhookDelivery.DeliveryStatus.PENDING).count();

        // Group by event type
        Map<String, Map<String, Long>> byEventType = all.stream()
                .collect(Collectors.groupingBy(
                        WebhookDelivery::getEventType,
                        Collectors.groupingBy(
                                d -> d.getStatus().name(),
                                Collectors.counting()
                        )
                ));

        List<Map<String, Object>> eventStats = byEventType.entrySet().stream()
                .map(e -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("eventType", e.getKey());
                    long rowDelivered = e.getValue().getOrDefault("SUCCESS", 0L);
                    long rowFailed = e.getValue().getOrDefault("FAILED", 0L);
                    long rowTotal = e.getValue().values().stream().mapToLong(Long::longValue).sum();
                    row.put("total", rowTotal);
                    row.put("delivered", rowDelivered);
                    row.put("failed", rowFailed);
                    row.put("successRate", rowTotal == 0 ? 0 : Math.round((double) rowDelivered / rowTotal * 100));
                    return row;
                })
                .sorted(Comparator.<Map<String, Object>, Long>comparing(m -> (Long) m.get("total")).reversed())
                .collect(Collectors.toList());

        // Average attempts
        double avgAttempts = all.stream()
                .mapToInt(WebhookDelivery::getAttemptCount).average().orElse(0);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", total);
        result.put("delivered", delivered);
        result.put("failed", failed);
        result.put("pending", pending);
        result.put("successRate", total == 0 ? 0 : Math.round((double) delivered / total * 100));
        result.put("avgAttempts", Math.round(avgAttempts * 10.0) / 10.0);
        result.put("byEventType", eventStats);

        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /** Geo analytics: top locations from device/session registry. */
    @GetMapping("/geo")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getGeoAnalytics(
            @RequestParam(defaultValue = "20") int top) {
        List<com.aza.backend.entity.RefreshToken> tokens =
                refreshTokenRepository.findAll(PageRequest.of(0, 5000)).getContent();

        // Count by location (non-null)
        Map<String, Long> locationCounts = tokens.stream()
                .filter(t -> t.getLocation() != null && !t.getLocation().isBlank())
                .collect(Collectors.groupingBy(
                        com.aza.backend.entity.RefreshToken::getLocation,
                        Collectors.counting()
                ));

        List<Map<String, Object>> topLocations = locationCounts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(Math.min(top, 50))
                .map(e -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("location", e.getKey());
                    row.put("sessions", e.getValue());
                    return row;
                })
                .collect(Collectors.toList());

        long totalWithLocation = locationCounts.values().stream().mapToLong(Long::longValue).sum();
        long totalSessions = tokens.size();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("topLocations", topLocations);
        result.put("totalSessions", totalSessions);
        result.put("sessionsWithLocation", totalWithLocation);
        result.put("unknownSessions", totalSessions - totalWithLocation);

        return ResponseEntity.ok(ApiResponse.success(result));
    }

    /** Geo analytics: top locations from transaction initiations. */
    @GetMapping("/geo/transactions")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getTransactionGeoAnalytics(
            @RequestParam(defaultValue = "20") int top) {
        List<com.aza.backend.entity.Transaction> txns =
                transactionRepository.findAll(PageRequest.of(0, 10000)).getContent();

        Map<String, Long> locationCounts = txns.stream()
                .filter(t -> t.getInitiationLocation() != null && !t.getInitiationLocation().isBlank())
                .collect(Collectors.groupingBy(
                        com.aza.backend.entity.Transaction::getInitiationLocation,
                        Collectors.counting()
                ));

        List<Map<String, Object>> topLocations = locationCounts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(Math.min(top, 50))
                .map(e -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("location", e.getKey());
                    row.put("transactions", e.getValue());
                    return row;
                })
                .collect(Collectors.toList());

        long totalWithLocation = locationCounts.values().stream().mapToLong(Long::longValue).sum();
        long totalTransactions = txns.size();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("topLocations", topLocations);
        result.put("totalTransactions", totalTransactions);
        result.put("transactionsWithLocation", totalWithLocation);
        result.put("unknownTransactions", totalTransactions - totalWithLocation);

        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
