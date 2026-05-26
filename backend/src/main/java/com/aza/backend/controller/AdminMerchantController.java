package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.admin.MerchantStatsResponse;
import com.aza.backend.dto.merchant.*;
import com.aza.backend.service.CheckoutService;
import com.aza.backend.service.MerchantService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/merchants")
@RequiredArgsConstructor
public class AdminMerchantController {

    private final MerchantService merchantService;
    private final CheckoutService checkoutService;

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
}
