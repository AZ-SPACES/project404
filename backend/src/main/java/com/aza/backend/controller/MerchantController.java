package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.merchant.*;
import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.MerchantApiLog;
import com.aza.backend.entity.MerchantAuditLog;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.CheckoutSessionRepository;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.service.CheckoutService;
import com.aza.backend.service.MerchantService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/merchant")
@RequiredArgsConstructor
public class MerchantController {

    private final MerchantService merchantService;
    private final CheckoutService checkoutService;
    private final MerchantRepository merchantRepository;
    private final CheckoutSessionRepository checkoutSessionRepository;
    private final UserRepository userRepository;

    // ==================== HANDLE CHECK ====================

    @GetMapping("/check-handle")
    public ResponseEntity<ApiResponse<Boolean>> checkHandle(@RequestParam String handle) {
        return ResponseEntity.ok(ApiResponse.success(merchantService.isHandleAvailable(handle)));
    }

    // ==================== PROFILE ====================

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<MerchantResponse>> getMe(@AuthenticationPrincipal User user) {
        MerchantResponse merchant = merchantService.getMyMerchant(user.getId());
        return ResponseEntity.ok(ApiResponse.success(merchant));
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<MerchantResponse>> register(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody MerchantRegisterRequest request) {
        MerchantResponse merchant = merchantService.register(user.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(merchant));
    }

    @PutMapping("/me")
    public ResponseEntity<ApiResponse<MerchantResponse>> updateMe(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody UpdateMerchantRequest request) {
        return ResponseEntity.ok(ApiResponse.success(merchantService.updateMerchant(user.getId(), request)));
    }

    @PostMapping("/logo")
    public ResponseEntity<ApiResponse<MerchantResponse>> uploadLogo(
            @AuthenticationPrincipal User user,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(ApiResponse.success(merchantService.uploadLogo(user.getId(), file)));
    }

    // ==================== BALANCE ====================

    @GetMapping("/balance")
    public ResponseEntity<ApiResponse<BalanceResponse>> getBalance(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(merchantService.getBalance(user.getId())));
    }

    // ==================== REPORTS ====================

    @GetMapping("/reports/summary")
    public ResponseEntity<ApiResponse<ReportSummaryResponse>> getReportSummary(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(merchantService.getReportSummary(user.getId())));
    }

    // ==================== KYB ====================

    @GetMapping("/kyb")
    public ResponseEntity<ApiResponse<KybStatusResponse>> getKybStatus(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(merchantService.getKybStatus(user.getId())));
    }

    @PostMapping("/kyb")
    public ResponseEntity<ApiResponse<KybStatusResponse>> submitKyb(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody KybSubmitRequest request) {
        return ResponseEntity.ok(ApiResponse.success(merchantService.submitKyb(user.getId(), request)));
    }

    @PostMapping("/kyb/document")
    public ResponseEntity<ApiResponse<KybDocumentResponse>> uploadDocument(
            @AuthenticationPrincipal User user,
            @RequestParam("file") MultipartFile file,
            @RequestParam("type") String documentType) {
        return ResponseEntity.ok(ApiResponse.success(
                merchantService.uploadKybDocument(user.getId(), file, documentType)));
    }

    @PostMapping("/kyb/submit")
    public ResponseEntity<ApiResponse<KybStatusResponse>> finalSubmit(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(merchantService.submitKybFinal(user.getId())));
    }

    // ==================== CHECKOUT SESSIONS ====================

    @PostMapping("/sessions")
    public ResponseEntity<ApiResponse<CheckoutSessionResponse>> createSession(
            @AuthenticationPrincipal Object principal,
            @Valid @RequestBody CreateCheckoutSessionRequest request) {
        UUID merchantId = resolveMerchantId(principal);
        CheckoutSessionResponse session = checkoutService.createSession(merchantId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(session));
    }

    @GetMapping("/sessions")
    public ResponseEntity<ApiResponse<Page<CheckoutSessionResponse>>> listSessions(
            @AuthenticationPrincipal Object principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String q) {
        UUID merchantId = resolveMerchantId(principal);
        if (status != null || from != null || to != null || q != null) {
            return ResponseEntity.ok(ApiResponse.success(
                    checkoutService.searchMerchantSessions(merchantId, page, size, status, from, to, q)));
        }
        return ResponseEntity.ok(ApiResponse.success(
                checkoutService.listMerchantSessions(merchantId, page, size)));
    }

    @GetMapping("/sessions/{sessionId}")
    public ResponseEntity<ApiResponse<CheckoutSessionResponse>> getSession(
            @AuthenticationPrincipal Object principal,
            @PathVariable UUID sessionId) {
        UUID merchantId = resolveMerchantId(principal);
        return ResponseEntity.ok(ApiResponse.success(checkoutService.getMerchantSession(sessionId, merchantId)));
    }

    @PostMapping("/sessions/{sessionId}/expire")
    public ResponseEntity<ApiResponse<CheckoutSessionResponse>> expireSession(
            @AuthenticationPrincipal User user,
            @PathVariable UUID sessionId) {
        return ResponseEntity.ok(ApiResponse.success(checkoutService.expireSession(sessionId, user.getId())));
    }

    // ==================== API KEYS ====================

    @GetMapping("/api-keys")
    public ResponseEntity<ApiResponse<List<ApiKeyResponse>>> listApiKeys(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(merchantService.listApiKeys(user.getId())));
    }

    @PostMapping("/api-keys")
    public ResponseEntity<ApiResponse<ApiKeyResponse>> createApiKey(
            @AuthenticationPrincipal User user,
            @RequestBody(required = false) CreateApiKeyRequest request) {
        if (request == null) request = new CreateApiKeyRequest();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(merchantService.createApiKey(user.getId(), request)));
    }

    @DeleteMapping("/api-keys/{keyId}")
    public ResponseEntity<ApiResponse<Void>> revokeApiKey(
            @AuthenticationPrincipal User user,
            @PathVariable UUID keyId) {
        merchantService.revokeApiKey(user.getId(), keyId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PutMapping("/api-keys/{keyId}")
    public ResponseEntity<ApiResponse<ApiKeyResponse>> updateApiKey(
            @AuthenticationPrincipal User user,
            @PathVariable UUID keyId,
            @RequestBody @Valid UpdateApiKeyRequest request) {
        return ResponseEntity.ok(ApiResponse.success(merchantService.updateApiKey(user.getId(), keyId, request)));
    }

    @PostMapping("/api-keys/{keyId}/roll")
    public ResponseEntity<ApiResponse<ApiKeyResponse>> rollApiKey(
            @AuthenticationPrincipal User user,
            @PathVariable UUID keyId,
            @RequestBody(required = false) RollApiKeyRequest request) {
        if (request == null) request = new RollApiKeyRequest();
        return ResponseEntity.ok(ApiResponse.success(merchantService.rollApiKey(user.getId(), keyId, request)));
    }

    @GetMapping("/api-keys/logs")
    public ResponseEntity<ApiResponse<Page<MerchantApiLog>>> getApiLogs(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(merchantService.listApiLogs(user.getId(), page, size)));
    }

    // ==================== WEBHOOKS ====================

    @GetMapping("/webhooks")
    public ResponseEntity<ApiResponse<List<WebhookEndpointResponse>>> listWebhooks(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(merchantService.listWebhooks(user.getId())));
    }

    @PostMapping("/webhooks")
    public ResponseEntity<ApiResponse<WebhookEndpointResponse>> createWebhook(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody WebhookEndpointRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(merchantService.createWebhook(user.getId(), request)));
    }

    @PutMapping("/webhooks/{endpointId}")
    public ResponseEntity<ApiResponse<WebhookEndpointResponse>> updateWebhook(
            @AuthenticationPrincipal User user,
            @PathVariable UUID endpointId,
            @RequestBody WebhookEndpointRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                merchantService.updateWebhookEndpoint(user.getId(), endpointId, request)));
    }

    @GetMapping("/webhooks/{endpointId}/deliveries")
    public ResponseEntity<ApiResponse<List<WebhookDeliveryResponse>>> listWebhookDeliveries(
            @AuthenticationPrincipal User user,
            @PathVariable UUID endpointId) {
        return ResponseEntity.ok(ApiResponse.success(
                merchantService.listWebhookDeliveries(user.getId(), endpointId)));
    }

    @DeleteMapping("/webhooks/{endpointId}")
    public ResponseEntity<ApiResponse<Void>> deleteWebhook(
            @AuthenticationPrincipal User user,
            @PathVariable UUID endpointId) {
        merchantService.deleteWebhook(user.getId(), endpointId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    // ==================== PAYOUTS ====================

    @GetMapping("/payouts")
    public ResponseEntity<ApiResponse<Page<PayoutResponse>>> listPayouts(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(merchantService.listPayouts(user.getId(), page, size)));
    }

    @PostMapping("/payouts")
    public ResponseEntity<ApiResponse<PayoutResponse>> requestPayout(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody PayoutRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(merchantService.requestPayout(user.getId(), request)));
    }

    // ==================== AUTO-PAYOUT SETTINGS ====================

    @GetMapping("/auto-payout")
    public ResponseEntity<ApiResponse<AutoPayoutSettingsResponse>> getAutoPayoutSettings(
            @AuthenticationPrincipal User user) {
        Merchant merchant = requireMerchant(user.getId());
        return ResponseEntity.ok(ApiResponse.success(merchantService.getAutoPayoutSettings(merchant.getId())));
    }

    @PutMapping("/auto-payout")
    public ResponseEntity<ApiResponse<AutoPayoutSettingsResponse>> updateAutoPayoutSettings(
            @AuthenticationPrincipal User user,
            @RequestBody UpdateAutoPayoutSettingsRequest request) {
        return ResponseEntity.ok(ApiResponse.success(merchantService.updateAutoPayoutSettings(user.getId(), request)));
    }

    // ==================== CUSTOMERS ====================

    @GetMapping("/customers")
    public ResponseEntity<ApiResponse<Page<CustomerResponse>>> listCustomers(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(merchantService.listCustomers(user.getId(), page, size)));
    }

    // ==================== REFUND ====================

    @PostMapping("/sessions/{sessionId}/refund")
    public ResponseEntity<ApiResponse<CheckoutSessionResponse>> refundSession(
            @AuthenticationPrincipal User user,
            @PathVariable UUID sessionId) {
        Merchant merchant = requireMerchant(user.getId());
        return ResponseEntity.ok(ApiResponse.success(checkoutService.refundSession(merchant.getId(), sessionId)));
    }

    // ==================== DISPUTES (merchant view) ====================

    @GetMapping("/disputes")
    public ResponseEntity<ApiResponse<Page<MerchantDisputeResponse>>> listDisputes(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(merchantService.listMerchantDisputes(user.getId(), page, size)));
    }

    // ==================== AUDIT LOGS ====================

    @GetMapping("/audit-logs")
    public ResponseEntity<ApiResponse<Page<MerchantAuditLog>>> listAuditLogs(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(merchantService.listAuditLogs(user.getId(), page, size)));
    }

    // ==================== PUBLIC MERCHANT PROFILE ====================

    @GetMapping("/public/{handle}")
    public ResponseEntity<ApiResponse<MerchantResponse>> getPublicMerchantProfile(
            @PathVariable String handle) {
        Merchant merchant = merchantRepository.findByBusinessHandle(handle.toLowerCase())
                .orElseThrow(() -> new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND));
        if (merchant.getStatus() != Merchant.MerchantStatus.ACTIVE) {
            throw new AppException("NOT_ACTIVE", "Merchant is not accepting payments", HttpStatus.FORBIDDEN);
        }
        MerchantResponse resp = MerchantResponse.builder()
                .id(merchant.getId().toString())
                .businessName(merchant.getBusinessName())
                .businessHandle(merchant.getBusinessHandle())
                .businessDescription(merchant.getBusinessDescription())
                .logoUrl(merchant.getLogoUrl())
                .category(merchant.getCategory() != null ? merchant.getCategory().name() : null)
                .status(merchant.getStatus().name())
                .currency(merchant.getCurrency())
                .brandColor(merchant.getBrandColor())
                .checkoutTagline(merchant.getCheckoutTagline())
                .supportEmail(merchant.getSupportEmail())
                .build();
        return ResponseEntity.ok(ApiResponse.success(resp));
    }

    // ==================== ANALYTICS ====================

    @GetMapping("/analytics")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getAnalytics(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "30") int days) {
        int d = Math.min(Math.max(days, 7), 365);
        Merchant merchant = requireMerchant(user.getId());
        UUID merchantId = merchant.getId();

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startOfToday = now.toLocalDate().atStartOfDay();
        LocalDateTime periodStart = now.minusDays(d);
        LocalDateTime prevPeriodStart = now.minusDays(d * 2L);

        BigDecimal todayRevenue = checkoutSessionRepository.sumRevenueBetween(merchantId, startOfToday, now.plusDays(1));
        BigDecimal sevenDayRevenue = checkoutSessionRepository.sumNetAmountSince(merchantId, now.minusDays(7));
        BigDecimal periodRevenue = checkoutSessionRepository.sumRevenuePeriod(merchantId, periodStart, now.plusDays(1));
        BigDecimal prevPeriodRevenue = checkoutSessionRepository.sumRevenuePeriod(merchantId, prevPeriodStart, periodStart);
        BigDecimal allTimeRevenue = checkoutSessionRepository.sumAllTimeRevenue(merchantId);

        long periodSessionCount = checkoutSessionRepository.countTotalBetween(merchantId, periodStart, now.plusDays(1));
        long periodCompletedCount = checkoutSessionRepository.countCompletedBetween(merchantId, periodStart, now.plusDays(1));
        long prevSessionCount = checkoutSessionRepository.countTotalBetween(merchantId, prevPeriodStart, periodStart);
        long prevCompletedCount = checkoutSessionRepository.countCompletedBetween(merchantId, prevPeriodStart, periodStart);

        double conversionRate = periodSessionCount == 0 ? 0.0
                : (double) periodCompletedCount / periodSessionCount * 100.0;
        double prevConversionRate = prevSessionCount == 0 ? 0.0
                : (double) prevCompletedCount / prevSessionCount * 100.0;

        BigDecimal avgOrderValue = checkoutSessionRepository.avgOrderValue(merchantId);

        // % changes vs previous period
        double revenueChange = prevPeriodRevenue != null && prevPeriodRevenue.compareTo(BigDecimal.ZERO) > 0
                ? periodRevenue.subtract(prevPeriodRevenue).divide(prevPeriodRevenue, 4, java.math.RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).doubleValue()
                : (periodRevenue != null && periodRevenue.compareTo(BigDecimal.ZERO) > 0 ? 100.0 : 0.0);
        double completedChange = prevCompletedCount > 0
                ? ((double) (periodCompletedCount - prevCompletedCount) / prevCompletedCount) * 100.0
                : (periodCompletedCount > 0 ? 100.0 : 0.0);

        // Daily series
        List<Object[]> dailyRaw = checkoutSessionRepository.getDailyRevenueByAmount(merchantId, periodStart);
        List<Map<String, Object>> dailySeries = new ArrayList<>();
        for (Object[] row : dailyRaw) {
            Map<String, Object> point = new HashMap<>();
            point.put("date", row[0] != null ? row[0].toString() : null);
            point.put("revenue", row[1] != null ? row[1] : BigDecimal.ZERO);
            point.put("count", row[2] != null ? ((Number) row[2]).longValue() : 0L);
            dailySeries.add(point);
        }

        // Top customers (top 5 by total paid)
        List<Object[]> topRaw = checkoutSessionRepository.topCustomers(merchantId, PageRequest.of(0, 5));
        List<Map<String, Object>> topCustomers = new ArrayList<>();
        for (Object[] row : topRaw) {
            UUID customerId = (UUID) row[0];
            BigDecimal totalPaid = (BigDecimal) row[1];
            long paymentCount = ((Number) row[2]).longValue();
            String name = userRepository.findById(customerId)
                    .map(u -> u.getFirstName() != null ? u.getFirstName() + " " + u.getLastName() : u.getEmail())
                    .orElse(customerId.toString());
            Map<String, Object> c = new HashMap<>();
            c.put("userId", customerId);
            c.put("displayName", name);
            c.put("totalPaid", totalPaid);
            c.put("paymentCount", paymentCount);
            topCustomers.add(c);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("days", d);
        result.put("todayRevenue", todayRevenue);
        result.put("sevenDayRevenue", sevenDayRevenue);
        result.put("periodRevenue", periodRevenue);
        result.put("prevPeriodRevenue", prevPeriodRevenue);
        result.put("revenueChange", revenueChange);
        result.put("allTimeRevenue", allTimeRevenue);
        result.put("periodSessionCount", periodSessionCount);
        result.put("periodCompletedCount", periodCompletedCount);
        result.put("completedChange", completedChange);
        result.put("conversionRate", conversionRate);
        result.put("prevConversionRate", prevConversionRate);
        result.put("avgOrderValue", avgOrderValue);
        result.put("dailySeries", dailySeries);
        result.put("topCustomers", topCustomers);
        // Legacy fields for backward compat
        result.put("thirtyDayRevenue", d == 30 ? periodRevenue : checkoutSessionRepository.sumNetAmountSince(merchantId, now.minusDays(30)));
        result.put("thirtyDaySessionCount", d == 30 ? periodSessionCount : checkoutSessionRepository.countTotalFrom(merchantId, now.minusDays(30)));
        result.put("thirtyDayCompletedCount", d == 30 ? periodCompletedCount : checkoutSessionRepository.countCompletedFrom(merchantId, now.minusDays(30)));

        return ResponseEntity.ok(ApiResponse.success(result));
    }

    // ==================== CUSTOMER SESSIONS ====================

    @GetMapping("/customers/{customerId}/sessions")
    public ResponseEntity<ApiResponse<org.springframework.data.domain.Page<CheckoutSessionResponse>>> getCustomerSessions(
            @AuthenticationPrincipal User user,
            @PathVariable UUID customerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Merchant merchant = requireMerchant(user.getId());
        return ResponseEntity.ok(ApiResponse.success(
                checkoutService.listCustomerSessions(merchant.getId(), customerId, page, size)));
    }

    // ==================== DISPUTE RESPONSE ====================

    @PostMapping("/disputes/{disputeId}/respond")
    public ResponseEntity<ApiResponse<com.aza.backend.dto.merchant.MerchantDisputeResponse>> respondToDispute(
            @AuthenticationPrincipal User user,
            @PathVariable UUID disputeId,
            @RequestBody java.util.Map<String, String> body) {
        String response = body.get("response");
        if (response == null || response.isBlank()) {
            throw new com.aza.backend.exception.AppException("VALIDATION", "Response text is required", HttpStatus.BAD_REQUEST);
        }
        return ResponseEntity.ok(ApiResponse.success(
                merchantService.respondToDispute(user.getId(), disputeId, response.trim())));
    }

    // ==================== HELPERS ====================

    private UUID resolveMerchantId(Object principal) {
        if (principal instanceof User user) {
            return requireMerchant(user.getId()).getId();
        }
        if (principal instanceof Merchant merchant) {
            return merchant.getId();
        }
        throw new AppException("UNAUTHORIZED", "Not authenticated", HttpStatus.UNAUTHORIZED);
    }

    private Merchant requireMerchant(UUID userId) {
        return merchantRepository.findByUserId(userId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "No merchant account found", HttpStatus.NOT_FOUND));
    }
}
