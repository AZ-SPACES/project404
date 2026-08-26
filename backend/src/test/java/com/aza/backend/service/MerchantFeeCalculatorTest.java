package com.aza.backend.service;

import com.aza.backend.entity.Merchant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * One formula, many rates.
 *
 * <p>Collapsing five copies of the MDR arithmetic onto one helper must not collapse the
 * rates themselves: merchants are on different terms, and a negotiated rate, a promotional
 * rate and the standard rate all have to survive going through the same code. These tests
 * exist mostly to hold that line — the shared helper is about how a rate becomes an amount,
 * never about what the rate is.
 */
class MerchantFeeCalculatorTest {

    private final FeeCalculationService feeCalculationService = mock(FeeCalculationService.class);
    private final MerchantFeeCalculator calculator = new MerchantFeeCalculator(feeCalculationService);

    /** No rule matches unless a test says one does — the backstop path. */
    @BeforeEach
    void noRuleByDefault() {
        when(feeCalculationService.quote(any(), any(), any(), any()))
                .thenReturn(new FeeCalculationService.FeeQuote(BigDecimal.ZERO, null, true));
    }

    /** A merchant priced by an explicit override. */
    private static Merchant merchantAt(Integer bps) {
        return merchantOn("STANDARD", bps);
    }

    /** A merchant priced by their plan, with no override. */
    private static Merchant merchantOn(String plan, Integer overrideBps) {
        return Merchant.builder()
                .id(UUID.randomUUID()).userId(UUID.randomUUID())
                .businessName("Test").currency("GHS")
                .balance(BigDecimal.ZERO).totalVolume(BigDecimal.ZERO)
                .pricingPlan(plan)
                .feeRateBps(overrideBps)
                .build();
    }

    private void planCharges(String plan, String fee) {
        when(feeCalculationService.quote(eq(MerchantFeeCalculator.MDR_TRANSACTION_TYPE), any(), any(), eq(plan)))
                .thenReturn(new FeeCalculationService.FeeQuote(new BigDecimal(fee), UUID.randomUUID(), false));
    }

    @Test
    void differentMerchantsPayDifferentRatesOnTheSameAmount() {
        BigDecimal sale = new BigDecimal("1000.00");

        // An enterprise rate, the standard rate, and a zero-rated partner.
        assertEquals(0, new BigDecimal("8.00").compareTo(calculator.feeOn(merchantAt(80), sale)));
        assertEquals(0, new BigDecimal("15.00").compareTo(calculator.feeOn(merchantAt(150), sale)));
        assertEquals(0, new BigDecimal("25.00").compareTo(calculator.feeOn(merchantAt(250), sale)));
        assertEquals(0, BigDecimal.ZERO.compareTo(calculator.feeOn(merchantAt(0), sale)));
    }

    @Test
    void netIsTheAmountLessThatMerchantsOwnFee() {
        BigDecimal sale = new BigDecimal("1000.00");
        assertEquals(0, new BigDecimal("992.00").compareTo(calculator.netOf(merchantAt(80), sale)));
        assertEquals(0, new BigDecimal("975.00").compareTo(calculator.netOf(merchantAt(250), sale)));
    }

    @Test
    void aRateWithNoRoundNumberKeepsItsPrecisionUntilTheEnd() {
        // 175 bps of 33.33 is 0.583275 -> one rounding, at the end, to 0.58.
        assertEquals(0, new BigDecimal("0.58")
                .compareTo(calculator.feeOn(merchantAt(175), new BigDecimal("33.33"))));
    }

    @Test
    void feeAndNetAlwaysReconcileToTheAmount() {
        for (int bps : new int[]{0, 1, 80, 150, 175, 250, 9999, 10000}) {
            for (String amt : new String[]{"0.01", "7.77", "33.33", "1000.00", "999999.99"}) {
                Merchant m = merchantAt(bps);
                BigDecimal amount = new BigDecimal(amt);
                assertEquals(0, amount.compareTo(calculator.feeOn(m, amount).add(calculator.netOf(m, amount))),
                        "fee + net must equal the amount for " + bps + "bps of " + amt);
            }
        }
    }

    // ==================== plan pricing ====================

    @Test
    void withNoOverrideTheMerchantIsPricedByTheirPlan() {
        planCharges("ENTERPRISE", "8.00");
        assertEquals(0, new BigDecimal("8.00")
                .compareTo(calculator.feeOn(merchantOn("ENTERPRISE", null), new BigDecimal("1000.00"))));
    }

    @Test
    void twoPlansPriceTheSameSaleDifferently() {
        planCharges("STANDARD", "15.00");
        planCharges("ENTERPRISE", "8.00");
        BigDecimal sale = new BigDecimal("1000.00");

        assertEquals(0, new BigDecimal("15.00").compareTo(calculator.feeOn(merchantOn("STANDARD", null), sale)));
        assertEquals(0, new BigDecimal("8.00").compareTo(calculator.feeOn(merchantOn("ENTERPRISE", null), sale)));
    }

    @Test
    void anOverrideOutranksThePlan() {
        // The whole point of an override: this merchant negotiated terms, and the plan's
        // schedule must not quietly reprice them.
        planCharges("STANDARD", "15.00");
        assertEquals(0, new BigDecimal("5.00")
                .compareTo(calculator.feeOn(merchantOn("STANDARD", 50), new BigDecimal("1000.00"))));
        verify(feeCalculationService, never()).quote(any(), any(), any(), any());
    }

    @Test
    void aPlanWithNoRuleFallsBackToTheStandardRateRatherThanFree() {
        // Nothing is stubbed for this plan, so the engine reports no matching rule. The sale
        // must not become free: an unconfigured plan is a gap, not a giveaway.
        assertEquals(0, new BigDecimal("15.00")
                .compareTo(calculator.feeOn(merchantOn("UNCONFIGURED", null), new BigDecimal("1000.00"))));
    }

    @Test
    void merchantPricingNeverSpendsAPerPayerFreeAllowance() {
        // Passing a payer id here would let one plan's free tier be consumed by whichever
        // customer happened to buy first, which is not what a merchant rate means.
        planCharges("STANDARD", "15.00");
        calculator.feeOn(merchantOn("STANDARD", null), new BigDecimal("1000.00"));

        verify(feeCalculationService).quote(
                eq(MerchantFeeCalculator.MDR_TRANSACTION_TYPE), any(), eq(null), eq("STANDARD"));
    }

    @Test
    void anExplicitZeroIsNotTreatedAsMissing() {
        // A zero-rated merchant is a real commercial arrangement, not an absent rate.
        assertEquals(0, calculator.rateBpsOf(merchantAt(0)));
        assertEquals(0, BigDecimal.ZERO.compareTo(calculator.feeOn(merchantAt(0), new BigDecimal("500.00"))));
    }

    @Test
    void aFullRateTakesTheWholeSaleAndLeavesNothing() {
        // 10000 bps is the validated ceiling. It should be arithmetically coherent even
        // though maker-checker now stands between an admin and setting it.
        BigDecimal sale = new BigDecimal("500.00");
        assertEquals(0, sale.compareTo(calculator.feeOn(merchantAt(10000), sale)));
        assertEquals(0, BigDecimal.ZERO.compareTo(calculator.netOf(merchantAt(10000), sale)));
    }
}
