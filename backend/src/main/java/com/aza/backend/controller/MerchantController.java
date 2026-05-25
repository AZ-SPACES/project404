package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.merchant.*;
import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.service.CheckoutService;
import com.aza.backend.service.MerchantService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/merchant")
@RequiredArgsConstructor
public class MerchantController {

    private final MerchantService merchantService;
    private final CheckoutService checkoutService;
    private final MerchantRepository merchantRepository;

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

    @PostMapping("/logo")
    public ResponseEntity<ApiResponse<MerchantResponse>> uploadLogo(
            @AuthenticationPrincipal User user,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(ApiResponse.success(merchantService.uploadLogo(user.getId(), file)));
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
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Merchant merchant = requireMerchant(user.getId());
        return ResponseEntity.ok(ApiResponse.success(
                checkoutService.listMerchantSessions(merchant.getId(), page, size)));
    }

    @GetMapping("/sessions/{sessionId}")
    public ResponseEntity<ApiResponse<CheckoutSessionResponse>> getSession(
            @AuthenticationPrincipal User user,
            @PathVariable UUID sessionId) {
        Merchant merchant = requireMerchant(user.getId());
        return ResponseEntity.ok(ApiResponse.success(checkoutService.getMerchantSession(sessionId, merchant.getId())));
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
