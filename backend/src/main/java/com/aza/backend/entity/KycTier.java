package com.aza.backend.entity;

import java.math.BigDecimal;

/**
 * BoG-style tiered e-money limits. Each tier carries the caps that apply to a user
 * at that KYC level: per-transaction, daily, and monthly transaction value, plus the
 * maximum wallet balance the tier may hold ({@code maxBalance} null = no ceiling).
 *
 * <p>NOTE: the figures below are placeholders. Confirm the exact current values
 * against the Bank of Ghana e-money tier directives before launch.
 */
public enum KycTier {

    TIER_1(new BigDecimal("1000"),  new BigDecimal("2000"),  new BigDecimal("6000"),   new BigDecimal("5000")),
    TIER_2(new BigDecimal("5000"),  new BigDecimal("10000"), new BigDecimal("30000"),  new BigDecimal("20000")),
    TIER_3(new BigDecimal("25000"), new BigDecimal("50000"), new BigDecimal("200000"), null);

    private final BigDecimal singleLimit;
    private final BigDecimal dailyLimit;
    private final BigDecimal monthlyLimit;
    private final BigDecimal maxBalance;

    KycTier(BigDecimal singleLimit, BigDecimal dailyLimit, BigDecimal monthlyLimit, BigDecimal maxBalance) {
        this.singleLimit = singleLimit;
        this.dailyLimit = dailyLimit;
        this.monthlyLimit = monthlyLimit;
        this.maxBalance = maxBalance;
    }

    public BigDecimal singleLimit()  { return singleLimit; }
    public BigDecimal dailyLimit()   { return dailyLimit; }
    public BigDecimal monthlyLimit() { return monthlyLimit; }
    /** Null = no wallet-balance ceiling for this tier. */
    public BigDecimal maxBalance()   { return maxBalance; }
}
