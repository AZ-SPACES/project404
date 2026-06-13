package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.MerchantStatsResponse;
import com.aza.backend.dto.merchant.*;
import com.aza.backend.entity.MerchantPayout;
import com.aza.backend.entity.WebhookDelivery;
import com.aza.backend.entity.WebhookEndpoint;
import com.aza.backend.repository.MerchantPayoutRepository;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.repository.WebhookDeliveryRepository;
import com.aza.backend.repository.WebhookEndpointRepository;
import com.aza.backend.service.CheckoutService;
import com.aza.backend.service.MerchantService;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/admin/merchants")
@RequiredArgsConstructor
// FINANCE owns settlements/payouts/fees; COMPLIANCE owns KYB review
@PreAuthorize("hasAnyRole('ADMIN','FINANCE','COMPLIANCE')")
public class AdminMerchantController {

    private final MerchantService merchantService;
    private final CheckoutService checkoutService;
    private final MerchantPayoutRepository payoutRepository;
    private final WebhookEndpointRepository webhookEndpointRepository;
    private final WebhookDeliveryRepository webhookDeliveryRepository;
    private final MerchantRepository merchantRepository;

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<MerchantStatsResponse>> stats() {
        return ResponseEntity.ok(ApiResponse.success(merchantService.adminGetStats()));
    }

    @GetMapping("/kyb-queue")
    public ResponseEntity<ApiResponse<Page<MerchantResponse>>> kybQueue(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(ApiResponse.success(merchantService.adminGetKybQueue(page, size)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Page<MerchantResponse>>> list(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(merchantService.adminSearch(query, status, page, size)));
    }

    @GetMapping("/{merchantId}")
    public ResponseEntity<ApiResponse<MerchantResponse>> get(@PathVariable UUID merchantId) {
        return ResponseEntity.ok(ApiResponse.success(merchantService.adminGetById(merchantId)));
    }

    @GetMapping("/{merchantId}/kyb")
    public ResponseEntity<ApiResponse<KybStatusResponse>> getKyb(@PathVariable UUID merchantId) {
        // Find user via merchant, then call getKybStatus
        return ResponseEntity.ok(ApiResponse.success(merchantService.getKybStatusForAdmin(merchantId)));
    }

    @PostMapping("/{merchantId}/kyb/review")
    public ResponseEntity<ApiResponse<KybStatusResponse>> reviewKyb(
            @PathVariable UUID merchantId,
            @RequestBody KybReviewRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                merchantService.adminReviewKyb(merchantId, request.isApprove(),
                        request.getRejectionReason(), request.getMoreInfoRequest())));
    }

    @PutMapping("/{merchantId}/status")
    public ResponseEntity<ApiResponse<MerchantResponse>> setStatus(
            @PathVariable UUID merchantId,
            @RequestBody StatusRequest request) {
        return ResponseEntity.ok(ApiResponse.success(merchantService.adminSetStatus(merchantId, request.getStatus())));
    }

    @PatchMapping("/{merchantId}/fee-rate")
    public ResponseEntity<ApiResponse<MerchantResponse>> setFeeRate(
            @PathVariable UUID merchantId,
            @RequestBody FeeRateRequest request) {
        return ResponseEntity.ok(ApiResponse.success(merchantService.adminSetFeeRate(merchantId, request.getFeeRateBps())));
    }

    @GetMapping("/{merchantId}/payouts")
    public ResponseEntity<ApiResponse<Page<PayoutResponse>>> getPayouts(
            @PathVariable UUID merchantId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(merchantService.adminGetPayouts(merchantId, page, size)));
    }

    @GetMapping("/{merchantId}/sessions")
    public ResponseEntity<ApiResponse<Page<CheckoutSessionResponse>>> getSessions(
            @PathVariable UUID merchantId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(checkoutService.listMerchantSessions(merchantId, page, size)));
    }

    @Data
    public static class KybReviewRequest {
        private boolean approve;
        private String rejectionReason;
        private String moreInfoRequest;
    }

    @Data
    public static class StatusRequest {
        private String status;
    }

    @Data
    public static class FeeRateRequest {
        private int feeRateBps;
    }

    // ── Global payouts (cross-merchant) ──────────────────────────────────────

    @Builder
    @Data
    public static class GlobalPayoutRow {
        private String id;
        private String merchantId;
        private String merchantName;
        private java.math.BigDecimal amount;
        private String currency;
        private String status;
        private String note;
        private String requestedAt;
        private String completedAt;
    }

    @GetMapping("/payouts/all")
    @PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
    public ResponseEntity<ApiResponse<Page<GlobalPayoutRow>>> getAllPayouts(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageRequest pageable = PageRequest.of(page, Math.min(size, 50));
        Page<MerchantPayout> payouts;
        if (status != null && !status.isBlank()) {
            payouts = payoutRepository.findAllByStatusOrderByRequestedAtDesc(
                    MerchantPayout.PayoutStatus.valueOf(status.toUpperCase()), pageable);
        } else {
            payouts = payoutRepository.findAllByOrderByRequestedAtDesc(pageable);
        }
        Map<UUID, String> nameCache = new java.util.HashMap<>();
        Page<GlobalPayoutRow> result = payouts.map(p -> {
            String name = nameCache.computeIfAbsent(p.getMerchantId(), id ->
                    merchantRepository.findById(id)
                            .map(m -> m.getBusinessName()).orElse("Unknown"));
            return GlobalPayoutRow.builder()
                    .id(p.getId().toString())
                    .merchantId(p.getMerchantId().toString())
                    .merchantName(name)
                    .amount(p.getAmount())
                    .currency(p.getCurrency())
                    .status(p.getStatus().name())
                    .note(p.getNote())
                    .requestedAt(p.getRequestedAt() != null ? p.getRequestedAt().toString() : null)
                    .completedAt(p.getCompletedAt() != null ? p.getCompletedAt().toString() : null)
                    .build();
        });
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    // ── Webhook deliveries per merchant ───────────────────────────────────────

    @Builder
    @Data
    public static class WebhookDeliveryRow {
        private String id;
        private String endpointId;
        private String eventType;
        private String status;
        private Integer attemptCount;
        private Integer responseStatusCode;
        private String createdAt;
        private String lastAttemptAt;
    }

    @GetMapping("/{merchantId}/webhook-deliveries")
    @PreAuthorize("hasAnyRole('ADMIN','FINANCE')")
    public ResponseEntity<ApiResponse<Page<WebhookDeliveryRow>>> getWebhookDeliveries(
            @PathVariable UUID merchantId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        List<UUID> endpointIds = webhookEndpointRepository.findAllByMerchantId(merchantId)
                .stream().map(WebhookEndpoint::getId).collect(Collectors.toList());
        if (endpointIds.isEmpty()) {
            return ResponseEntity.ok(ApiResponse.success(org.springframework.data.domain.Page.empty()));
        }
        PageRequest pageable = PageRequest.of(page, Math.min(size, 50));
        Page<WebhookDelivery> deliveries = webhookDeliveryRepository
                .findAllByEndpointIdInOrderByCreatedAtDesc(endpointIds, pageable);
        Page<WebhookDeliveryRow> result = deliveries.map(d -> WebhookDeliveryRow.builder()
                .id(d.getId().toString())
                .endpointId(d.getEndpointId().toString())
                .eventType(d.getEventType())
                .status(d.getStatus().name())
                .attemptCount(d.getAttemptCount())
                .responseStatusCode(d.getResponseStatusCode())
                .createdAt(d.getCreatedAt() != null ? d.getCreatedAt().toString() : null)
                .lastAttemptAt(d.getLastAttemptAt() != null ? d.getLastAttemptAt().toString() : null)
                .build());
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
