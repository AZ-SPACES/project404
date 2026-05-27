package com.aza.backend.dto.merchant;

import com.aza.backend.entity.MerchantDiscountCode;

import java.math.BigDecimal;

public record ValidatedDiscount(
        BigDecimal discountAmount,
        BigDecimal finalAmount,
        MerchantDiscountCode entity
) {}
