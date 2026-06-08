package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.merchant.CheckoutSessionResponse;
import com.aza.backend.dto.merchant.CreateCheckoutSessionRequest;
import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.OAuthAccessToken;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.service.CheckoutService;
import com.aza.backend.service.OAuthService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/oauth/payments")
@RequiredArgsConstructor
public class OAuthPaymentController {

    private final OAuthService oAuthService;
    private final CheckoutService checkoutService;
    private final MerchantRepository merchantRepository;

    private static final String DEEP_LINK_BASE = "aza://pay/";
    private static final String CHECKOUT_BASE  = "https://pay.aza.systems/c/";

    @Data
    public static class OAuthPaymentSessionRequest {
        @NotNull @DecimalMin("0.01")
        private BigDecimal amount;

        private String currency = "GHS";
        private String description;
        private String metadata;
        private String successUrl;
        private String cancelUrl;
        private String idempotencyKey;
    }

    @Data
    public static class OAuthPaymentSessionResponse {
        private String sessionId;
        private String checkoutUrl;
        private String deepLink;
        private String status;
        private BigDecimal amount;
        private String currency;
        private String merchantName;
    }

    /**
     * Third-party app creates a payment session using the user's OAuth access token.
     * Requires the token to have the "payment" scope and the OAuth client to have
     * a linked merchant account.
     */
    @PostMapping("/sessions")
    public ResponseEntity<ApiResponse<OAuthPaymentSessionResponse>> createSession(
            @RequestHeader("Authorization") String authHeader,
            @Valid @RequestBody OAuthPaymentSessionRequest request) {

        OAuthAccessToken token = resolveToken(authHeader);
        requireScope(token, "payment");

        Merchant merchant = getMerchantForToken(token);

        CreateCheckoutSessionRequest sessionRequest = new CreateCheckoutSessionRequest();
        sessionRequest.setAmount(request.getAmount());
        sessionRequest.setDescription(request.getDescription());
        sessionRequest.setMetadata(request.getMetadata());
        sessionRequest.setSuccessUrl(request.getSuccessUrl());
        sessionRequest.setCancelUrl(request.getCancelUrl());
        sessionRequest.setIdempotencyKey(request.getIdempotencyKey());

        CheckoutSessionResponse session = checkoutService.createSession(merchant.getId(), sessionRequest);

        OAuthPaymentSessionResponse response = new OAuthPaymentSessionResponse();
        response.setSessionId(session.getId());
        response.setCheckoutUrl(CHECKOUT_BASE + session.getId());
        response.setDeepLink(DEEP_LINK_BASE + session.getId());
        response.setStatus(session.getStatus());
        response.setAmount(session.getAmount());
        response.setCurrency(session.getCurrency());
        response.setMerchantName(merchant.getBusinessName());

        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    /**
     * Poll payment session status — usable by the third-party server with the user's access token
     * or directly (public read by session ID already at /api/v1/checkout/{id}).
     */
    @GetMapping("/sessions/{sessionId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSession(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable UUID sessionId) {

        OAuthAccessToken token = resolveToken(authHeader);
        requireScope(token, "payment");

        getMerchantForToken(token); // validates client is still linked

        CheckoutSessionResponse session = checkoutService.getSession(sessionId);
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "sessionId",   session.getId(),
                "status",      session.getStatus(),
                "amount",      session.getAmount(),
                "currency",    session.getCurrency(),
                "checkoutUrl", CHECKOUT_BASE + session.getId(),
                "deepLink",    DEEP_LINK_BASE + session.getId(),
                "completedAt", session.getCompletedAt() != null ? session.getCompletedAt().toString() : null
        )));
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private OAuthAccessToken resolveToken(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new AppException("UNAUTHORIZED", "Bearer token required.", HttpStatus.UNAUTHORIZED);
        }
        return oAuthService.resolveAccessToken(authHeader.substring(7));
    }

    private void requireScope(OAuthAccessToken token, String scope) {
        if (!token.getScopeList().contains(scope)) {
            throw new AppException("INSUFFICIENT_SCOPE",
                    "Access token does not have the '" + scope + "' scope.", HttpStatus.FORBIDDEN);
        }
    }

    private Merchant getMerchantForToken(OAuthAccessToken token) {
        java.util.UUID merchantId = token.getClient().getMerchantId();
        if (merchantId == null) {
            throw new AppException("NO_MERCHANT_LINKED",
                    "This OAuth client is not linked to a merchant account. Link a merchant account in your developer settings.",
                    HttpStatus.BAD_REQUEST);
        }
        return merchantRepository.findById(merchantId)
                .orElseThrow(() -> new AppException("MERCHANT_NOT_FOUND", "Linked merchant not found.", HttpStatus.NOT_FOUND));
    }
}
