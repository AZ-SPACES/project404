package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.PaymentProofResponse;
import com.aza.backend.dto.PaymentVerifyResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.PaymentProofService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class PaymentProofController {

    private final PaymentProofService paymentProofService;

    /** Authenticated: a party to the transaction generates a verifiable proof QR. */
    @GetMapping("/api/v1/payments/{transactionId}/proof")
    public ResponseEntity<ApiResponse<PaymentProofResponse>> getProof(
            @AuthenticationPrincipal User user,
            @PathVariable UUID transactionId) {
        return ResponseEntity.ok(ApiResponse.success(
                paymentProofService.generateProof(transactionId, user)));
    }

    /** Public: anyone can verify a scanned proof QR (it carries its own signature). */
    @GetMapping("/api/v1/public/payments/verify")
    public ResponseEntity<ApiResponse<PaymentVerifyResponse>> verify(
            @RequestParam String ref,
            @RequestParam String sig) {
        return ResponseEntity.ok(ApiResponse.success(paymentProofService.verify(ref, sig)));
    }
}
