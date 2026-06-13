package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.PromoCode;
import com.aza.backend.entity.PromoCodeRedemption;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.PromoCodeRepository;
import com.aza.backend.repository.PromoCodeRedemptionRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/promos")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminPromoController {

    private final PromoCodeRepository promoCodeRepository;
    private final PromoCodeRedemptionRepository promoCodeRedemptionRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<PromoCode>>> list() {
        return ResponseEntity.ok(ApiResponse.success(promoCodeRepository.findAllByOrderByCreatedAtDesc()));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<PromoCode>> create(
            @RequestBody CreatePromoRequest request,
            @AuthenticationPrincipal User admin) {
        PromoCode promo = PromoCode.builder()
                .code(request.getCode())
                .description(request.getDescription())
                .creditAmountGhs(request.getCreditAmountGhs())
                .maxUses(request.getMaxUses())
                .expiresAt(request.getExpiresAt())
                .createdBy(admin != null ? admin.getEmail() : "system")
                .build();
        return ResponseEntity.ok(ApiResponse.success(promoCodeRepository.save(promo)));
    }

    @PatchMapping("/{id}/toggle")
    public ResponseEntity<ApiResponse<PromoCode>> toggle(@PathVariable UUID id) {
        PromoCode promo = promoCodeRepository.findById(id)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Promo code not found", HttpStatus.NOT_FOUND));
        promo.setActive(!promo.isActive());
        return ResponseEntity.ok(ApiResponse.success(promoCodeRepository.save(promo)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable UUID id) {
        promoCodeRepository.findById(id)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Promo code not found", HttpStatus.NOT_FOUND));
        promoCodeRepository.deleteById(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @GetMapping("/{id}/redemptions")
    public ResponseEntity<ApiResponse<List<PromoCodeRedemption>>> redemptions(@PathVariable UUID id) {
        promoCodeRepository.findById(id)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Promo code not found", HttpStatus.NOT_FOUND));
        return ResponseEntity.ok(ApiResponse.success(
                promoCodeRedemptionRepository.findAllByPromoCodeIdOrderByRedeemedAtDesc(id)));
    }

    @Data
    public static class CreatePromoRequest {
        private String code;
        private String description;
        private BigDecimal creditAmountGhs;
        private Integer maxUses;
        private LocalDateTime expiresAt;
    }
}
