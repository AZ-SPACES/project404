package com.aza.backend.service;

import com.aza.backend.entity.Merchant;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * The merchant discount rate, in one place.
 *
 * <p>This arithmetic used to be copy-pasted into five money paths — the two store-payment
 * branches of {@code TransferService}, the live and sandbox branches of
 * {@code CheckoutService}, and {@code MandateChargeExecutor}. All five agreed, which is
 * the dangerous kind of duplication: nothing failed, so nothing pointed at the four copies
 * that would be left behind by the first edit to the fifth.
 *
 * <p><b>Rates stay per-merchant.</b> Nothing here flattens them — {@code feeRateBps} is
 * read off the merchant on every call, so a negotiated rate, a promotional rate and the
 * standard rate all run through the same formula and come out differently. What is shared
 * is how a rate becomes an amount, not what the rate is.
 */
@Component
public class MerchantFeeCalculator {

    /**
     * The default applied when a merchant carries no rate of its own: 150 bps (1.5%).
     *
     * <p>A fallback, not a policy. The column is the source of truth and merchants are
     * expected to differ; this only keeps a missing value from becoming an NPE in the
     * middle of a payment, which is what {@code BigDecimal.valueOf(Integer)} does when the
     * rate is null.
     */
    public static final int DEFAULT_FEE_RATE_BPS = 150;

    /** The merchant's rate in basis points, falling back to the default when unset. */
    public int rateBpsOf(Merchant merchant) {
        Integer bps = merchant.getFeeRateBps();
        return bps != null ? bps : DEFAULT_FEE_RATE_BPS;
    }

    /**
     * AZA's cut of {@code amount} for this merchant, rounded to the currency's two places.
     *
     * <p>The rate is divided at scale 6 before it multiplies, so a rate like 175 bps does
     * not lose precision on its way to the amount; the product is then rounded once, at
     * the end, to the two decimal places money is actually stored in.
     */
    public BigDecimal feeOn(Merchant merchant, BigDecimal amount) {
        BigDecimal feeRate = BigDecimal.valueOf(rateBpsOf(merchant))
                .divide(BigDecimal.valueOf(10_000), 6, RoundingMode.HALF_UP);
        return amount.multiply(feeRate).setScale(2, RoundingMode.HALF_UP);
    }

    /** What the merchant banks: {@code amount} less {@link #feeOn}. */
    public BigDecimal netOf(Merchant merchant, BigDecimal amount) {
        return amount.subtract(feeOn(merchant, amount));
    }
}
