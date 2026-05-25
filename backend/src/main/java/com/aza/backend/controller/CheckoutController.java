package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.merchant.CheckoutSessionResponse;
import com.aza.backend.dto.merchant.ConfirmCheckoutRequest;
import com.aza.backend.entity.User;
import com.aza.backend.service.CheckoutService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/checkout")
@RequiredArgsConstructor
public class CheckoutController {

    private final CheckoutService checkoutService;

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
}
