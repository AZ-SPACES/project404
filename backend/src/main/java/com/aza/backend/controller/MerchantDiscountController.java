package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.merchant.*;
import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.User;
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
public class MerchantDiscountController {

    private final MerchantDiscountService discountService;
    private final MerchantRepository merchantRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<DiscountCodeResponse>>> listCodes(
            @AuthenticationPrincipal User user) {
        UUID merchantId = requireMerchant(user.getId()).getId();
        return ResponseEntity.ok(ApiResponse.success(discountService.listCodes(merchantId)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<DiscountCodeResponse>> createCode(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody CreateDiscountCodeRequest request) {
        UUID merchantId = requireMerchant(user.getId()).getId();
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(discountService.createCode(merchantId, request)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<DiscountCodeResponse>> updateCode(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id,
            @RequestBody UpdateDiscountCodeRequest request) {
        UUID merchantId = requireMerchant(user.getId()).getId();
        return ResponseEntity.ok(ApiResponse.success(discountService.updateCode(merchantId, id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteCode(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        UUID merchantId = requireMerchant(user.getId()).getId();
        discountService.deleteCode(merchantId, id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    private Merchant requireMerchant(UUID userId) {
        return merchantRepository.findByUserId(userId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "No merchant account found", HttpStatus.NOT_FOUND));
    }
}
