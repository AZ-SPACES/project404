package com.aza.backend.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.merchant.CheckoutSessionResponse;
import com.aza.backend.dto.merchant.ConfirmCheckoutRequest;
import com.aza.backend.dto.merchant.ValidateDiscountRequest;
import com.aza.backend.dto.merchant.ValidatedDiscount;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.CheckoutSessionRepository;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.service.CheckoutService;
import com.aza.backend.service.MerchantDiscountService;
import com.aza.backend.util.EmailService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/checkout")
@RequiredArgsConstructor
@Tag(name = "Checkout", description = "Public checkout sessions and payment confirmation")
public class CheckoutController {

    private final CheckoutService checkoutService;
    private final MerchantDiscountService discountService;
    private final CheckoutSessionRepository sessionRepository;
    private final MerchantRepository merchantRepository;
    private final EmailService emailService;

    /** Public — no auth required. Returns session details for the customer to review. */
    @GetMapping("/{sessionId}")
    public ResponseEntity<ApiResponse<CheckoutSessionResponse>> getSession(@PathVariable UUID sessionId) {
        return ResponseEntity.ok(ApiResponse.success(checkoutService.getSession(sessionId)));
    }

    /** Requires AZA JWT. Customer confirms payment with their passcode. */
    @PostMapping("/{sessionId}/confirm")
    public ResponseEntity<ApiResponse<CheckoutSessionResponse>> confirm(
            @PathVariable UUID sessionId,
            @AuthenticationPrincipal User user,
            @Valid @RequestBody ConfirmCheckoutRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                checkoutService.confirmPayment(sessionId, user.getId(), request)));
    }

    /** Cancel a pending session — requires merchant JWT. Only the owning merchant can cancel. */
    @PostMapping("/{sessionId}/cancel")
    public ResponseEntity<ApiResponse<CheckoutSessionResponse>> cancel(
            @PathVariable UUID sessionId,
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(checkoutService.cancelSession(sessionId, user.getId())));
    }

    /** Public — sends a copy of the payment receipt to the provided email address. */
    @PostMapping("/{sessionId}/receipt/email")
    public ResponseEntity<ApiResponse<Void>> sendReceipt(
            @PathVariable UUID sessionId,
            @RequestBody Map<String, @Email @NotBlank String> body) {

        String email = body.get("email");
        if (email == null || email.isBlank()) {
            throw new AppException("INVALID_EMAIL", "A valid email address is required", HttpStatus.BAD_REQUEST);
        }

        var session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Session not found", HttpStatus.NOT_FOUND));

        if (session.getStatus().name().equals("COMPLETED")) {
            String ref = "CHK-" + sessionId.toString().substring(28).toUpperCase();
            String merchantName = merchantRepository.findById(session.getMerchantId())
                    .map(m -> m.getBusinessName()).orElse("Merchant");
            String paidAt = session.getCompletedAt() != null
                    ? session.getCompletedAt().format(java.time.format.DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm"))
                    : "—";
            emailService.sendCheckoutReceiptEmail(email, ref, session.getAmount(),
                    session.getCurrency() != null ? session.getCurrency() : "GHS", merchantName, paidAt);
        }

        return ResponseEntity.ok(ApiResponse.success(null));
    }

    /**
     * Public — no auth required.
     * Validates a discount code and returns the discount amount and final amount.
     * Does NOT redeem the code.
     */
    @PostMapping("/discount/validate")
    public ResponseEntity<ApiResponse<Map<String, Object>>> validateDiscount(
            @Valid @RequestBody ValidateDiscountRequest request) {
        ValidatedDiscount result = discountService.validateAndApply(
                request.getCode(), request.getMerchantId(), request.getAmount());
        Map<String, Object> response = Map.of(
                "discountAmount", result.discountAmount(),
                "finalAmount", result.finalAmount()
        );
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
