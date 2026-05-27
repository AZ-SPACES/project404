package com.aza.backend.service;

import com.aza.backend.dto.merchant.*;
import com.aza.backend.entity.MerchantDiscountCode;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.MerchantDiscountCodeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class MerchantDiscountService {

    private final MerchantDiscountCodeRepository discountCodeRepository;

    private static final String CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final int CODE_LENGTH = 6;
    private static final int MAX_GENERATION_ATTEMPTS = 10;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    public List<DiscountCodeResponse> listCodes(UUID merchantId) {
        return discountCodeRepository.findByMerchantIdOrderByCreatedAtDesc(merchantId)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public DiscountCodeResponse createCode(UUID merchantId, CreateDiscountCodeRequest request) {
        MerchantDiscountCode.DiscountType discountType;
        try {
            discountType = MerchantDiscountCode.DiscountType.valueOf(request.getDiscountType().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException("INVALID_TYPE", "discountType must be PERCENTAGE or FIXED", HttpStatus.BAD_REQUEST);
        }

        if (request.getValue().compareTo(BigDecimal.ZERO) <= 0) {
            throw new AppException("INVALID_VALUE", "Discount value must be greater than 0", HttpStatus.BAD_REQUEST);
        }
        if (discountType == MerchantDiscountCode.DiscountType.PERCENTAGE
                && request.getValue().compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new AppException("INVALID_VALUE", "Percentage discount cannot exceed 100", HttpStatus.BAD_REQUEST);
        }

        String code;
        if (request.getCode() != null && !request.getCode().isBlank()) {
            code = request.getCode().trim().toUpperCase();
            if (discountCodeRepository.existsByCodeAndMerchantId(code, merchantId)) {
                throw new AppException("CODE_EXISTS", "A discount code with this code already exists", HttpStatus.CONFLICT);
            }
        } else {
            code = generateUniqueCode(merchantId);
        }

        MerchantDiscountCode entity = MerchantDiscountCode.builder()
                .merchantId(merchantId)
                .code(code)
                .discountType(discountType)
                .value(request.getValue())
                .maxUses(request.getMaxUses())
                .expiresAt(request.getExpiresAt())
                .active(true)
                .build();

        discountCodeRepository.save(entity);
        log.info("Discount code created: merchantId={}, code={}, type={}, value={}",
                merchantId, code, discountType, request.getValue());
        return toResponse(entity);
    }

    @Transactional
    public DiscountCodeResponse updateCode(UUID merchantId, UUID id, UpdateDiscountCodeRequest request) {
        MerchantDiscountCode entity = discountCodeRepository.findByIdAndMerchantId(id, merchantId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Discount code not found", HttpStatus.NOT_FOUND));

        if (request.getActive() != null) {
            entity.setActive(request.getActive());
        }
        if (request.getMaxUses() != null) {
            entity.setMaxUses(request.getMaxUses());
        }
        if (request.getExpiresAt() != null) {
            entity.setExpiresAt(request.getExpiresAt());
        }

        discountCodeRepository.save(entity);
        return toResponse(entity);
    }

    @Transactional
    public void deleteCode(UUID merchantId, UUID id) {
        MerchantDiscountCode entity = discountCodeRepository.findByIdAndMerchantId(id, merchantId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Discount code not found", HttpStatus.NOT_FOUND));
        discountCodeRepository.delete(entity);
        log.info("Discount code deleted: id={}, merchantId={}", id, merchantId);
    }

    /**
     * Validates a discount code and calculates the discount amount.
     * Does NOT increment usedCount.
     */
    public ValidatedDiscount validateAndApply(String code, UUID merchantId, BigDecimal originalAmount) {
        MerchantDiscountCode entity = discountCodeRepository.findByCodeAndMerchantIdAndActiveTrue(
                        code.toUpperCase(), merchantId)
                .orElseThrow(() -> new AppException("INVALID_CODE", "Invalid or inactive discount code", HttpStatus.BAD_REQUEST));

        if (entity.getExpiresAt() != null && LocalDateTime.now().isAfter(entity.getExpiresAt())) {
            throw new AppException("CODE_EXPIRED", "This discount code has expired", HttpStatus.BAD_REQUEST);
        }

        if (entity.getMaxUses() != null && entity.getUsedCount() >= entity.getMaxUses()) {
            throw new AppException("CODE_EXHAUSTED", "This discount code has reached its usage limit", HttpStatus.BAD_REQUEST);
        }

        BigDecimal discountAmount;
        if (entity.getDiscountType() == MerchantDiscountCode.DiscountType.PERCENTAGE) {
            discountAmount = originalAmount.multiply(entity.getValue())
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        } else {
            discountAmount = entity.getValue().min(originalAmount);
        }
        discountAmount = discountAmount.setScale(2, RoundingMode.HALF_UP);
        BigDecimal finalAmount = originalAmount.subtract(discountAmount).max(BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);

        return new ValidatedDiscount(discountAmount, finalAmount, entity);
    }

    @Transactional
    public void redeemCode(MerchantDiscountCode code) {
        code.setUsedCount(code.getUsedCount() + 1);
        discountCodeRepository.save(code);
    }

    private String generateUniqueCode(UUID merchantId) {
        for (int attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
            StringBuilder sb = new StringBuilder(CODE_LENGTH);
            for (int i = 0; i < CODE_LENGTH; i++) {
                sb.append(CODE_CHARS.charAt(SECURE_RANDOM.nextInt(CODE_CHARS.length())));
            }
            String candidate = sb.toString();
            if (!discountCodeRepository.existsByCodeAndMerchantId(candidate, merchantId)) {
                return candidate;
            }
        }
        throw new AppException("GENERATION_FAILED",
                "Could not generate a unique discount code. Please provide one manually.", HttpStatus.INTERNAL_SERVER_ERROR);
    }

    private DiscountCodeResponse toResponse(MerchantDiscountCode entity) {
        return DiscountCodeResponse.builder()
                .id(entity.getId())
                .code(entity.getCode())
                .discountType(entity.getDiscountType().name())
                .value(entity.getValue())
                .maxUses(entity.getMaxUses())
                .usedCount(entity.getUsedCount())
                .expiresAt(entity.getExpiresAt())
                .active(entity.isActive())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
