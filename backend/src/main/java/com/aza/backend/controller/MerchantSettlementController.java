package com.aza.backend.controller;

import io.swagger.v3.oas.annotations.tags.Tag;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.merchant.SettlementDetailResponse;
import com.aza.backend.dto.merchant.SettlementResponse;
import com.aza.backend.entity.Merchant;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.service.MerchantSettlementService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/merchant/settlements")
@RequiredArgsConstructor
@Tag(name = "Merchant Settlements", description = "Settlement batches and payouts")
public class MerchantSettlementController {

    private final MerchantSettlementService settlementService;
    private final MerchantRepository merchantRepository;

    // Handlers accept both principal types: User (dashboard JWT) and Merchant
    // (MerchantApiKeyFilter) — this path is on the filter's activated list.

    @GetMapping
    public ResponseEntity<ApiResponse<Page<SettlementResponse>>> listSettlements(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        UUID merchantId = resolveMerchantId(principal);
        return ResponseEntity.ok(ApiResponse.success(settlementService.listSettlements(merchantId, page, size)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<SettlementDetailResponse>> getSettlement(
            @io.swagger.v3.oas.annotations.Parameter(hidden = true) @AuthenticationPrincipal Object principal,
            @PathVariable UUID id) {
        UUID merchantId = resolveMerchantId(principal);
        return ResponseEntity.ok(ApiResponse.success(settlementService.getSettlement(merchantId, id)));
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
