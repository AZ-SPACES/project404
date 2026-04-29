package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.chat.PaymentRequestMessageRequest;
import com.aza.backend.dto.chat.PaymentRequestResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.PaymentRequestService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/payment-requests")
@RequiredArgsConstructor
public class PaymentRequestController {

    private final PaymentRequestService paymentRequestService;

    /**
     * POST /api/v1/payment-requests
     * Send a payment request in a chat.
     */
    @PostMapping
    public ResponseEntity<ApiResponse<PaymentRequestResponse>> sendPaymentRequest(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody PaymentRequestMessageRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(paymentRequestService.sendPaymentRequest(user, request)));
    }

    /**
     * POST /api/v1/payment-requests/{id}/approve
     * Payer approves a pending payment request — requires 5-digit passcode.
     */
    @PostMapping("/{id}/approve")
    public ResponseEntity<ApiResponse<PaymentRequestResponse>> approvePaymentRequest(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id,
            @Valid @RequestBody ApproveRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                paymentRequestService.approvePaymentRequest(user, id, request.getPasscode())));
    }

    /**
     * POST /api/v1/payment-requests/{id}/decline
     * Payer declines a pending payment request.
     */
    @PostMapping("/{id}/decline")
    public ResponseEntity<ApiResponse<PaymentRequestResponse>> declinePaymentRequest(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(
                paymentRequestService.declinePaymentRequest(user, id)));
    }

    /**
     * DELETE /api/v1/payment-requests/{id}
     * Requester cancels their own pending payment request.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<PaymentRequestResponse>> cancelPaymentRequest(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(
                paymentRequestService.cancelPaymentRequest(user, id)));
    }

    @Data
    public static class ApproveRequest {
        @NotBlank(message = "Passcode is required")
        private String passcode;
    }
}
