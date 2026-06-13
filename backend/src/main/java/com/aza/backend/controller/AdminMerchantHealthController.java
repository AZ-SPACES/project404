package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.WebhookEndpoint;
import com.aza.backend.repository.CheckoutSessionRepository;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.repository.WebhookDeliveryRepository;
import com.aza.backend.repository.WebhookEndpointRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/admin/merchants/health")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
public class AdminMerchantHealthController {

    private final MerchantRepository merchantRepository;
    private final CheckoutSessionRepository checkoutSessionRepository;
    private final WebhookDeliveryRepository webhookDeliveryRepository;
    private final WebhookEndpointRepository webhookEndpointRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> merchantHealth() {
        // Build checkout summary: merchantId -> [total, successful, lastTransactionAt]
        List<Object[]> checkoutSummary = checkoutSessionRepository.merchantCheckoutSummary();
        Map<UUID, Object[]> checkoutByMerchant = new HashMap<>();
        for (Object[] row : checkoutSummary) {
            UUID merchantId = (UUID) row[0];
            checkoutByMerchant.put(merchantId, row);
        }

        // For each merchant, get endpoint ids and count failed webhooks
        List<Merchant> merchants = merchantRepository.findAll();

        List<Map<String, Object>> result = new ArrayList<>();
        for (Merchant merchant : merchants) {
            UUID merchantId = merchant.getId();

            Object[] cs = checkoutByMerchant.get(merchantId);
            long totalCheckouts = cs != null ? ((Number) cs[1]).longValue() : 0L;
            long successfulCheckouts = cs != null ? ((Number) cs[2]).longValue() : 0L;
            LocalDateTime lastTransactionAt = cs != null ? (LocalDateTime) cs[3] : null;

            double successRate = totalCheckouts > 0
                    ? Math.round((successfulCheckouts * 1000.0 / totalCheckouts)) / 10.0
                    : 0.0;

            // Count failed webhooks for this merchant's endpoints
            List<UUID> endpointIds = webhookEndpointRepository.findAllByMerchantId(merchantId)
                    .stream().map(WebhookEndpoint::getId).collect(Collectors.toList());

            long failedWebhooks = 0L;
            if (!endpointIds.isEmpty()) {
                List<Object[]> failedRows = webhookDeliveryRepository.countFailedByEndpointIds(endpointIds);
                failedWebhooks = failedRows.stream()
                        .mapToLong(r -> ((Number) r[1]).longValue())
                        .sum();
            }

            Map<String, Object> m = new LinkedHashMap<>();
            m.put("merchantId", merchantId);
            m.put("businessName", merchant.getBusinessName());
            m.put("totalCheckouts", totalCheckouts);
            m.put("successfulCheckouts", successfulCheckouts);
            m.put("successRate", successRate);
            m.put("failedWebhooks", failedWebhooks);
            m.put("lastTransactionAt", lastTransactionAt);
            result.add(m);
        }

        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
