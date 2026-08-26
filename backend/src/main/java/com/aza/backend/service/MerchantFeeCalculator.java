package com.aza.backend.service;

import com.aza.backend.entity.Merchant;
import lombok.RequiredArgsConstructor;
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
 * <p><b>Rates stay per-merchant.</b> Nothing here flattens them. A merchant may carry an
 * override negotiated with them alone; otherwise their pricing plan resolves a versioned
 * rule that can itself band by sale size. What is shared is how a rate becomes an amount,
 * never what the rate is.
 */
@Component
@RequiredArgsConstructor
public class MerchantFeeCalculator {

    /** The fee-engine transaction type merchant pricing resolves under. */
    public static final String MDR_TRANSACTION_TYPE = "MERCHANT_MDR";

    private final FeeCalculationService feeCalculationService;

    /**
     * Last resort when a merchant has neither an override nor a plan rule that matches:
     * 150 bps (1.5%).
     *
     * <p>A backstop, not a policy. Pricing lives in the merchant's override or their plan's
     * rule; this exists so that a plan nobody configured prices sales at the standard rate
     * rather than silently giving them away free.
     */
    public static final int DEFAULT_FEE_RATE_BPS = 150;

    /**
     * The per-merchant override in basis points, or the default when there is none.
     *
     * <p>Only meaningful for a merchant that has an override. A merchant priced by their
     * plan has no single "rate" to report here, because the plan may band by amount — ask
     * {@link #feeOn} for a specific sale instead.
     */
    public int rateBpsOf(Merchant merchant) {
        Integer bps = merchant.getFeeRateBps();
        return bps != null ? bps : DEFAULT_FEE_RATE_BPS;
    }

    /**
     * AZA's cut of {@code amount} for this merchant, rounded to the currency's two places.
     *
     * <p>Resolved in three steps, most specific first:
     * <ol>
     *   <li><b>Override.</b> A rate negotiated with this merchant alone outranks everything.
     *       It is deliberately not versioned — it is a contract term, not a schedule.</li>
     *   <li><b>Plan.</b> Otherwise the merchant's {@code pricingPlan} resolves a versioned
     *       {@code MERCHANT_MDR} rule, which brings amount bands, min/max caps and effective
     *       dating with it.</li>
     *   <li><b>Default.</b> If no rule matches — a plan with nothing configured — 1.5%, so
     *       a gap in the schedule cannot silently make a merchant's sales free.</li>
     * </ol>
     */
    public BigDecimal feeOn(Merchant merchant, BigDecimal amount) {
        if (amount == null || amount.signum() <= 0) return BigDecimal.ZERO;

        Integer override = merchant.getFeeRateBps();
        if (override != null) {
            return applyBps(override, amount);
        }

        // The payer id is null: merchant pricing has no per-payer free allowance to
        // consume, and passing the merchant's id here would let a plan's free tiers be
        // spent by whichever customer happened to buy first.
        FeeCalculationService.FeeQuote quote = feeCalculationService.quote(
                MDR_TRANSACTION_TYPE, amount, null, merchant.getPricingPlan());
        if (quote.ruleId() != null) {
            return quote.fee();
        }
        return applyBps(DEFAULT_FEE_RATE_BPS, amount);
    }

    /**
     * Basis points of an amount.
     *
     * <p>The rate divides at scale 6 before it multiplies, so a rate like 175 bps does not
     * lose precision on its way to the amount; the product rounds once, at the end, to the
     * two decimal places money is stored in.
     */
    private BigDecimal applyBps(int bps, BigDecimal amount) {
        BigDecimal feeRate = BigDecimal.valueOf(bps)
                .divide(BigDecimal.valueOf(10_000), 6, RoundingMode.HALF_UP);
        return amount.multiply(feeRate).setScale(2, RoundingMode.HALF_UP);
    }

    /** What the merchant banks: {@code amount} less {@link #feeOn}. */
    public BigDecimal netOf(Merchant merchant, BigDecimal amount) {
        return amount.subtract(feeOn(merchant, amount));
    }
}
