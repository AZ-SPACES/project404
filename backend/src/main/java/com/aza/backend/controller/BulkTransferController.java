package com.aza.backend.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.merchant.*;
import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.service.BulkTransferService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/merchant/bulk-transfers")
@RequiredArgsConstructor
@Tag(name = "Merchant Bulk Transfers", description = "Bulk transfer batches")
public class BulkTransferController {

    private final BulkTransferService bulkTransferService;
    private final MerchantRepository merchantRepository;

    @PostMapping
    public ResponseEntity<ApiResponse<BulkTransferResponse>> createBulkTransfer(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody CreateBulkTransferRequest request) {
        UUID merchantId = requireMerchant(user.getId()).getId();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(bulkTransferService.createBulkTransfer(merchantId, request)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Page<BulkTransferResponse>>> listBulkTransfers(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        UUID merchantId = requireMerchant(user.getId()).getId();
        return ResponseEntity.ok(ApiResponse.success(bulkTransferService.listBulkTransfers(merchantId, page, size)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<BulkTransferDetailResponse>> getBulkTransfer(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        UUID merchantId = requireMerchant(user.getId()).getId();
        return ResponseEntity.ok(ApiResponse.success(bulkTransferService.getBulkTransfer(merchantId, id)));
    }

    private Merchant requireMerchant(UUID userId) {
        return merchantRepository.findByUserId(userId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "No merchant account found", HttpStatus.NOT_FOUND));
    }
}
