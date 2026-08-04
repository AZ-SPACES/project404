package com.aza.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.security.filter.MerchantApiKeyFilter;
import com.aza.backend.dto.mandate.ChargeMandateRequest;
import com.aza.backend.dto.mandate.MandateChargeResponse;
import com.aza.backend.dto.mandate.MandateResponse;
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
import com.aza.backend.service.PaymentMandateService;
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
@Tag(name = "Merchant", description = "Merchant profile, balance, KYB, API keys, sessions, webhooks and payouts")
public class MerchantController {

    private final MerchantService merchantService;
    private final CheckoutService checkoutService;
    private final MerchantRepository merchantRepository;
    private final CheckoutSessionRepository checkoutSessionRepository;
    private final UserRepository userRepository;
    private final PaymentMandateService mandateService;

    // ==================== HANDLE CHECK ====================

    @GetMapping("/check-handle")
    public ResponseEntity<ApiResponse<Boolean>> checkHandle(@RequestParam String handle) {
        return ResponseEntity.ok(ApiResponse.success(merchantService.isHandleAvailable(handle)));
    }

    // ==================== PROFILE ====================

    // /me is on the API-key surface — it is the "test your key" endpoint in the
    // developer guides, so it must work with X-Api-Key as well as a dashboard JWT.
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<MerchantResponse>> getMe(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal) {
        MerchantResponse merchant = merchantService.getMyMerchant(PrincipalResolver.ownerUserId(principal));
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
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @Valid @RequestBody UpdateMerchantRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                merchantService.updateMerchant(PrincipalResolver.ownerUserId(principal), request)));
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
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @RequestAttribute(name = MerchantApiKeyFilter.API_KEY_ENVIRONMENT_ATTR, required = false) String keyEnvironment,
            @Valid @RequestBody CreateCheckoutSessionRequest request) {
        UUID merchantId = resolveMerchantId(principal);
        // A test session is created when the request is authenticated with an aza_test_ key.
        boolean testMode = "TEST".equalsIgnoreCase(keyEnvironment);
        CheckoutSessionResponse session = checkoutService.createSession(merchantId, request, testMode);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(session));
    }

    @Operation(summary = "Simulate payment of a test session",
            description = "Completes a test-mode checkout session and fires test webhooks without moving funds. "
                    + "Only works for sessions created with an aza_test_ key.")
    @PostMapping("/sessions/{sessionId}/simulate")
    public ResponseEntity<ApiResponse<CheckoutSessionResponse>> simulateSession(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @PathVariable UUID sessionId) {
        UUID merchantId = resolveMerchantId(principal);
        return ResponseEntity.ok(ApiResponse.success(checkoutService.simulatePayment(sessionId, merchantId)));
    }

    @GetMapping("/sessions")
    public ResponseEntity<ApiResponse<Page<CheckoutSessionResponse>>> listSessions(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String reference,
            @RequestParam(required = false) String release,
            @RequestParam(required = false) String mode) {
        UUID merchantId = resolveMerchantId(principal);
        // mode: "test" → sandbox only, "live" → live only, anything else → both.
        Boolean testMode = "test".equalsIgnoreCase(mode) ? Boolean.TRUE
                : "live".equalsIgnoreCase(mode) ? Boolean.FALSE : null;
        if (status != null || from != null || to != null || q != null || reference != null
                || release != null || testMode != null) {
            return ResponseEntity.ok(ApiResponse.success(
                    checkoutService.searchMerchantSessions(
                            merchantId, page, size, status, from, to, q, testMode, reference, release)));
        }
        return ResponseEntity.ok(ApiResponse.success(
                checkoutService.listMerchantSessions(merchantId, page, size)));
    }

    @Operation(summary = "Reconcile completed sessions by reference",
            description = "Returns the count, gross total and net total of COMPLETED checkout sessions "
                    + "carrying the given `reference`. A platform merchant uses this to reconcile payments "
                    + "for one of its tenants/sellers or an order group.")
    @GetMapping("/sessions/summary")
    public ResponseEntity<ApiResponse<Map<String, Object>>> sessionsSummary(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @RequestParam String reference) {
        UUID merchantId = resolveMerchantId(principal);
        return ResponseEntity.ok(ApiResponse.success(checkoutService.reconcileByReference(merchantId, reference)));
    }

    @GetMapping("/sessions/{sessionId}")
    public ResponseEntity<ApiResponse<CheckoutSessionResponse>> getSession(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @PathVariable UUID sessionId) {
        UUID merchantId = resolveMerchantId(principal);
        return ResponseEntity.ok(ApiResponse.success(checkoutService.getMerchantSession(sessionId, merchantId)));
    }

    // ==================== TRANSACTION VERIFICATION ====================

    @Operation(summary = "Verify a transaction by id",
            description = "Look up a transaction credited to your account — e.g. verify a Mini App SDK "
                    + "payment server-side using the transactionId returned by aza.requestPayment(). "
                    + "Only transactions your account received are visible; any other id returns 404.")
    @GetMapping("/transactions/{transactionId}")
    public ResponseEntity<ApiResponse<MerchantTransactionResponse>> verifyTransaction(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @PathVariable UUID transactionId) {
        UUID merchantId = resolveMerchantId(principal);
        return ResponseEntity.ok(ApiResponse.success(
                merchantService.verifyTransaction(merchantId, transactionId)));
    }

    @PostMapping("/sessions/{sessionId}/expire")
    public ResponseEntity<ApiResponse<CheckoutSessionResponse>> expireSession(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @PathVariable UUID sessionId) {
        return ResponseEntity.ok(ApiResponse.success(
                checkoutService.expireSession(sessionId, PrincipalResolver.ownerUserId(principal))));
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
    public ResponseEntity<ApiResponse<List<WebhookEndpointResponse>>> listWebhooks(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal) {
        return ResponseEntity.ok(ApiResponse.success(
                merchantService.listWebhooks(PrincipalResolver.ownerUserId(principal))));
    }

    @PostMapping("/webhooks")
    public ResponseEntity<ApiResponse<WebhookEndpointResponse>> createWebhook(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @Valid @RequestBody WebhookEndpointRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(
                        merchantService.createWebhook(PrincipalResolver.ownerUserId(principal), request)));
    }

    @PutMapping("/webhooks/{endpointId}")
    public ResponseEntity<ApiResponse<WebhookEndpointResponse>> updateWebhook(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @PathVariable UUID endpointId,
            @RequestBody WebhookEndpointRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                merchantService.updateWebhookEndpoint(PrincipalResolver.ownerUserId(principal), endpointId, request)));
    }

    @PostMapping("/webhooks/{endpointId}/regenerate-secret")
    public ResponseEntity<ApiResponse<WebhookEndpointResponse>> regenerateWebhookSecret(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @PathVariable UUID endpointId) {
        return ResponseEntity.ok(ApiResponse.success(
                merchantService.regenerateWebhookSecret(PrincipalResolver.ownerUserId(principal), endpointId)));
    }

    @GetMapping("/webhooks/{endpointId}/deliveries")
    public ResponseEntity<ApiResponse<List<WebhookDeliveryResponse>>> listWebhookDeliveries(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @PathVariable UUID endpointId) {
        return ResponseEntity.ok(ApiResponse.success(
                merchantService.listWebhookDeliveries(PrincipalResolver.ownerUserId(principal), endpointId)));
    }

    @DeleteMapping("/webhooks/{endpointId}")
    public ResponseEntity<ApiResponse<Void>> deleteWebhook(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @PathVariable UUID endpointId) {
        merchantService.deleteWebhook(PrincipalResolver.ownerUserId(principal), endpointId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    // ==================== PAYOUTS ====================

    // Payout WRITES are additionally gated in MerchantApiKeyFilter: secret keys are denied,
    // and restricted keys must explicitly carry payouts:write (drain-to-bank capability).

    @GetMapping("/payouts")
    public ResponseEntity<ApiResponse<Page<PayoutResponse>>> listPayouts(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                merchantService.listPayouts(PrincipalResolver.ownerUserId(principal), page, size)));
    }

    @PostMapping("/payouts")
    public ResponseEntity<ApiResponse<PayoutResponse>> requestPayout(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @Valid @RequestBody PayoutRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(
                        merchantService.requestPayout(PrincipalResolver.ownerUserId(principal), request)));
    }

    // ==================== AUTO-PAYOUT SETTINGS ====================

    @GetMapping("/auto-payout")
    public ResponseEntity<ApiResponse<AutoPayoutSettingsResponse>> getAutoPayoutSettings(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal) {
        UUID merchantId = resolveMerchantId(principal);
        return ResponseEntity.ok(ApiResponse.success(merchantService.getAutoPayoutSettings(merchantId)));
    }

    @PutMapping("/auto-payout")
    public ResponseEntity<ApiResponse<AutoPayoutSettingsResponse>> updateAutoPayoutSettings(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @RequestBody UpdateAutoPayoutSettingsRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                merchantService.updateAutoPayoutSettings(PrincipalResolver.ownerUserId(principal), request)));
    }

    // ==================== CUSTOMERS ====================

    @GetMapping("/customers")
    public ResponseEntity<ApiResponse<Page<CustomerResponse>>> listCustomers(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                merchantService.listCustomers(PrincipalResolver.ownerUserId(principal), page, size)));
    }

    // ==================== REFUND ====================

    @PostMapping("/sessions/{sessionId}/refund")
    public ResponseEntity<ApiResponse<CheckoutSessionResponse>> refundSession(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @PathVariable UUID sessionId) {
        UUID merchantId = resolveMerchantId(principal);
        return ResponseEntity.ok(ApiResponse.success(checkoutService.refundSession(merchantId, sessionId)));
    }

    // ==================== HOLDS (manual release) ====================

    @Operation(summary = "Release a held payment",
            description = "Settles a session created with release=MANUAL: recipients are paid and "
                    + "you keep the remainder net of the Aza fee. Omit `recipients` to release "
                    + "everything still held, or supply them to release part of it. Requires an "
                    + "Idempotency-Key header — this call moves money and integrators retry.")
    @PostMapping("/sessions/{sessionId}/release")
    public ResponseEntity<ApiResponse<CheckoutSessionResponse>> releaseHold(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @PathVariable UUID sessionId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true)
            @RequestAttribute(name = MerchantApiKeyFilter.API_KEY_ID_ATTR, required = false) UUID apiKeyId,
            @Valid @RequestBody(required = false) ReleaseHoldRequest request) {
        UUID merchantId = resolveMerchantId(principal);
        requireIdempotencyKey(idempotencyKey);
        return ResponseEntity.ok(ApiResponse.success(
                checkoutService.releaseHold(merchantId, sessionId, request, idempotencyKey, apiKeyId)));
    }

    @Operation(summary = "Refund a held payment",
            description = "Returns held money to the payer, in full or in part. Cannot fail while "
                    + "the money is held — nobody has been credited yet. The Aza fee is returned "
                    + "in full on a full refund.")
    @PostMapping("/sessions/{sessionId}/hold/refund")
    public ResponseEntity<ApiResponse<CheckoutSessionResponse>> refundHold(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @PathVariable UUID sessionId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @io.swagger.v3.oas.annotations.Parameter(hidden = true)
            @RequestAttribute(name = MerchantApiKeyFilter.API_KEY_ID_ATTR, required = false) UUID apiKeyId,
            @Valid @RequestBody(required = false) RefundHoldRequest request) {
        UUID merchantId = resolveMerchantId(principal);
        requireIdempotencyKey(idempotencyKey);
        return ResponseEntity.ok(ApiResponse.success(
                checkoutService.refundHold(merchantId, sessionId, request, idempotencyKey, apiKeyId)));
    }

    /**
     * Money-moving hold endpoints require an explicit key rather than defaulting to
     * "no idempotency" — a dropped response on release must be safely retryable.
     */
    private void requireIdempotencyKey(String key) {
        if (key == null || key.isBlank()) {
            throw new AppException("IDEMPOTENCY_KEY_REQUIRED",
                    "An Idempotency-Key header is required on this endpoint", HttpStatus.BAD_REQUEST);
        }
    }

    // ==================== DIRECT DEBIT (payment mandates) ====================

    @Operation(summary = "List mandates paying this merchant")
    @GetMapping("/mandates")
    public ResponseEntity<ApiResponse<Page<MandateResponse>>> listMandates(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        UUID merchantId = resolveMerchantId(principal);
        return ResponseEntity.ok(ApiResponse.success(
                mandateService.listForMerchant(merchantId, PageRequest.of(page, Math.min(size, 100)))
                        .map(mandateService::toResponse)));
    }

    @Operation(summary = "Charge history for a mandate")
    @GetMapping("/mandates/{mandateId}/charges")
    public ResponseEntity<ApiResponse<Page<MandateChargeResponse>>> listMandateCharges(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @PathVariable UUID mandateId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        UUID merchantId = resolveMerchantId(principal);
        return ResponseEntity.ok(ApiResponse.success(
                mandateService.listCharges(merchantId, mandateId, PageRequest.of(page, Math.min(size, 100)))
                        .map(mandateService::toChargeResponse)));
    }

    @Operation(summary = "Charge a mandate",
            description = "Debits the mandate's payer on demand, server-to-server, with no passcode "
                    + "prompt — the payer already authorized this when they approved the mandate. "
                    + "Rejected if the amount exceeds the mandate's per-charge or period ceiling, the "
                    + "mandate isn't ACTIVE, or the payer's wallet can't cover it. An Idempotency-Key "
                    + "is required: replaying the same key returns the original result instead of "
                    + "charging twice.")
    @PostMapping("/mandates/{mandateId}/charge")
    public ResponseEntity<ApiResponse<MandateChargeResponse>> chargeMandate(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @PathVariable UUID mandateId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody ChargeMandateRequest request) {
        UUID merchantId = resolveMerchantId(principal);
        requireIdempotencyKey(idempotencyKey);
        return ResponseEntity.ok(ApiResponse.success(mandateService.toChargeResponse(
                mandateService.charge(merchantId, mandateId, request.getAmount(), request.getReference(), idempotencyKey))));
    }

    // ==================== DISPUTES (merchant view) ====================

    @GetMapping("/disputes")
    public ResponseEntity<ApiResponse<Page<MerchantDisputeResponse>>> listDisputes(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                merchantService.listMerchantDisputes(PrincipalResolver.ownerUserId(principal), page, size)));
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

    @GetMapping("/public/directory")
    public ResponseEntity<ApiResponse<List<PublicMerchantSummary>>> getPublicDirectory(
            @RequestParam(defaultValue = "30") int limit) {
        return ResponseEntity.ok(ApiResponse.success(merchantService.listPublicDirectory(limit)));
    }

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
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @PathVariable UUID customerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        UUID merchantId = resolveMerchantId(principal);
        return ResponseEntity.ok(ApiResponse.success(
                checkoutService.listCustomerSessions(merchantId, customerId, page, size)));
    }

    // ==================== DISPUTE RESPONSE ====================

    @PostMapping("/disputes/{disputeId}/respond")
    public ResponseEntity<ApiResponse<com.aza.backend.dto.merchant.MerchantDisputeResponse>> respondToDispute(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @PathVariable UUID disputeId,
            @RequestBody java.util.Map<String, String> body) {
        String response = body.get("response");
        if (response == null || response.isBlank()) {
            throw new com.aza.backend.exception.AppException("VALIDATION", "Response text is required", HttpStatus.BAD_REQUEST);
        }
        return ResponseEntity.ok(ApiResponse.success(
                merchantService.respondToDispute(PrincipalResolver.ownerUserId(principal), disputeId, response.trim())));
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
