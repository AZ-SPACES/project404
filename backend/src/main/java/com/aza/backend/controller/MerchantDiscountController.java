package com.aza.backend.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.merchant.*;
import com.aza.backend.entity.Merchant;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.service.MerchantDiscountService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/merchant/discount-codes")
@RequiredArgsConstructor
@Tag(name = "Merchant Discount Codes", description = "Create and manage discount codes")
public class MerchantDiscountController {

    private final MerchantDiscountService discountService;
    private final MerchantRepository merchantRepository;

    // Handlers accept both principal types: User (dashboard JWT) and Merchant
    // (MerchantApiKeyFilter) — this path is on the filter's activated list.

    @GetMapping
    public ResponseEntity<ApiResponse<List<DiscountCodeResponse>>> listCodes(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal) {
        UUID merchantId = resolveMerchantId(principal);
        return ResponseEntity.ok(ApiResponse.success(discountService.listCodes(merchantId)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<DiscountCodeResponse>> createCode(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @Valid @RequestBody CreateDiscountCodeRequest request) {
        UUID merchantId = resolveMerchantId(principal);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(discountService.createCode(merchantId, request)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<DiscountCodeResponse>> updateCode(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @PathVariable UUID id,
            @RequestBody UpdateDiscountCodeRequest request) {
        UUID merchantId = resolveMerchantId(principal);
        return ResponseEntity.ok(ApiResponse.success(discountService.updateCode(merchantId, id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteCode(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @PathVariable UUID id) {
        UUID merchantId = resolveMerchantId(principal);
        discountService.deleteCode(merchantId, id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    private UUID resolveMerchantId(Object principal) {
        if (principal instanceof Merchant merchant) {
            return merchant.getId();
        }
        return merchantRepository.findByUserId(PrincipalResolver.ownerUserId(principal))
                .orElseThrow(() -> new AppException("NOT_FOUND", "No merchant account found", HttpStatus.NOT_FOUND))
                .getId();
    }
}
