package com.aza.backend.service;

import com.aza.backend.entity.FeeRule;
import com.aza.backend.entity.MonthlyFeeUsage;
import com.aza.backend.repository.FeeRuleRepository;
import com.aza.backend.repository.MonthlyFeeUsageRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class FeeCalculationServiceTest {

    private final FeeRuleRepository feeRuleRepository = mock(FeeRuleRepository.class);
    private final MonthlyFeeUsageRepository usageRepository = mock(MonthlyFeeUsageRepository.class);
    private final FeeCalculationService service =
            new FeeCalculationService(feeRuleRepository, usageRepository);

    private final UUID payer = UUID.randomUUID();

    private FeeRule p2p() {
        return FeeRule.builder()
                .id(UUID.randomUUID())
                .transactionType("P2P")
                .feeType(FeeRule.FeeType.PERCENTAGE)
                .amount(new BigDecimal("0.5"))
                .maxFee(new BigDecimal("10"))
                .freePerTxnThreshold(new BigDecimal("100"))
                .freeMonthlyThreshold(new BigDecimal("1000"))
                .active(true)
                .build();
    }

    private FeeRule cashOut() {
        return FeeRule.builder()
                .id(UUID.randomUUID())
                .transactionType("CASH_OUT")
                .feeType(FeeRule.FeeType.PERCENTAGE)
                .amount(new BigDecimal("1.0"))
                .minFee(new BigDecimal("0.50"))
                .maxFee(new BigDecimal("15"))
                .active(true)
                .build();
    }

    private void usage(String type, String amount) {
        when(usageRepository.findByUserIdAndTransactionTypeAndUsageMonth(eq(payer), eq(type), anyString()))
                .thenReturn(Optional.of(MonthlyFeeUsage.builder()
                        .userId(payer).transactionType(type)
                        .usedAmount(new BigDecimal(amount)).build()));
    }

    @Test
    void noRuleMeansNoFee() {
        when(feeRuleRepository.findByTransactionTypeAndActiveTrue("CASH_IN")).thenReturn(List.of());
        var q = service.quote("CASH_IN", new BigDecimal("200"), payer);
        assertEquals(0, q.fee().compareTo(BigDecimal.ZERO));
        assertTrue(q.free());
        assertNull(q.ruleId());
    }

    @Test
    void smallP2pIsFreeByPerTxnTier() {
        when(feeRuleRepository.findByTransactionTypeAndActiveTrue("P2P")).thenReturn(List.of(p2p()));
        var q = service.quote("P2P", new BigDecimal("50"), payer);
        assertTrue(q.free());
        assertEquals(0, q.fee().compareTo(BigDecimal.ZERO));
    }

    @Test
    void largerP2pIsFreeWhileUnderMonthlyTier() {
        when(feeRuleRepository.findByTransactionTypeAndActiveTrue("P2P")).thenReturn(List.of(p2p()));
        usage("P2P", "0");
        var q = service.quote("P2P", new BigDecimal("150"), payer);
        assertTrue(q.free(), "150 is over the per-txn tier but the first 1000/month is free");
    }

    @Test
    void p2pChargedOncePastMonthlyTier() {
        when(feeRuleRepository.findByTransactionTypeAndActiveTrue("P2P")).thenReturn(List.of(p2p()));
        usage("P2P", "1000");
        var q = service.quote("P2P", new BigDecimal("150"), payer);
        assertFalse(q.free());
        assertEquals(new BigDecimal("0.75"), q.fee()); // 150 * 0.5%
    }

    @Test
    void p2pFeeIsCapped() {
        when(feeRuleRepository.findByTransactionTypeAndActiveTrue("P2P")).thenReturn(List.of(p2p()));
        usage("P2P", "2000");
        var q = service.quote("P2P", new BigDecimal("5000"), payer); // 25 -> capped 10
        assertEquals(new BigDecimal("10.00"), q.fee());
    }

    @Test
    void cashOutAppliesMinimum() {
        when(feeRuleRepository.findByTransactionTypeAndActiveTrue("CASH_OUT")).thenReturn(List.of(cashOut()));
        var q = service.quote("CASH_OUT", new BigDecimal("10"), payer); // 0.10 -> min 0.50
        assertEquals(new BigDecimal("0.50"), q.fee());
        assertFalse(q.free());
    }

    @Test
    void cashOutNormalAndCapped() {
        when(feeRuleRepository.findByTransactionTypeAndActiveTrue("CASH_OUT")).thenReturn(List.of(cashOut()));
        assertEquals(new BigDecimal("1.00"),
                service.quote("CASH_OUT", new BigDecimal("100"), payer).fee());
        assertEquals(new BigDecimal("15.00"),
                service.quote("CASH_OUT", new BigDecimal("5000"), payer).fee()); // 50 -> cap 15
    }

    // ==================== merchant pricing plans ====================
    //
    // The engine resolved on transaction type alone, which has no room for *who* is being
    // charged. A plan is that dimension: one versioned MERCHANT_MDR rule prices a whole
    // class of merchants, and merchants on different plans price differently.

    private FeeRule mdr(String plan, String percent) {
        return FeeRule.builder()
                .id(UUID.randomUUID())
                .transactionType("MERCHANT_MDR")
                .pricingPlan(plan)
                .feeType(FeeRule.FeeType.PERCENTAGE)
                .amount(new BigDecimal(percent))
                .active(true)
                .build();
    }

    @Test
    void twoPlansPriceTheSameSaleDifferently() {
        when(feeRuleRepository.findByTransactionTypeAndActiveTrue("MERCHANT_MDR"))
                .thenReturn(List.of(mdr("STANDARD", "1.5"), mdr("ENTERPRISE", "0.8")));
        BigDecimal sale = new BigDecimal("1000.00");

        assertEquals(0, new BigDecimal("15.00")
                .compareTo(service.quote("MERCHANT_MDR", sale, null, "STANDARD").fee()));
        assertEquals(0, new BigDecimal("8.00")
                .compareTo(service.quote("MERCHANT_MDR", sale, null, "ENTERPRISE").fee()));
    }

    @Test
    void aRuleForThisPlanBeatsTheCatchAll() {
        when(feeRuleRepository.findByTransactionTypeAndActiveTrue("MERCHANT_MDR"))
                .thenReturn(List.of(mdr(null, "1.5"), mdr("ENTERPRISE", "0.8")));

        assertEquals(0, new BigDecimal("8.00")
                .compareTo(service.quote("MERCHANT_MDR", new BigDecimal("1000.00"), null, "ENTERPRISE").fee()));
    }

    @Test
    void aPlanWithNoRuleOfItsOwnFallsToTheCatchAll() {
        when(feeRuleRepository.findByTransactionTypeAndActiveTrue("MERCHANT_MDR"))
                .thenReturn(List.of(mdr(null, "1.5"), mdr("ENTERPRISE", "0.8")));

        assertEquals(0, new BigDecimal("15.00")
                .compareTo(service.quote("MERCHANT_MDR", new BigDecimal("1000.00"), null, "CHARITY").fee()));
    }

    @Test
    void anotherPlansRuleIsNeverUsedAsAFallback() {
        // Pricing a merchant on somebody else's negotiated terms would be worse than
        // having no rule at all, so a non-matching plan rule must not apply.
        when(feeRuleRepository.findByTransactionTypeAndActiveTrue("MERCHANT_MDR"))
                .thenReturn(List.of(mdr("ENTERPRISE", "0.8")));

        var quote = service.quote("MERCHANT_MDR", new BigDecimal("1000.00"), null, "STANDARD");

        assertNull(quote.ruleId(), "no rule should have matched");
        assertEquals(0, BigDecimal.ZERO.compareTo(quote.fee()));
    }

    @Test
    void planMatchingIsCaseInsensitive() {
        when(feeRuleRepository.findByTransactionTypeAndActiveTrue("MERCHANT_MDR"))
                .thenReturn(List.of(mdr("ENTERPRISE", "0.8")));

        assertEquals(0, new BigDecimal("8.00")
                .compareTo(service.quote("MERCHANT_MDR", new BigDecimal("1000.00"), null, "enterprise").fee()));
    }

    @Test
    void consumerFeesAreUnaffected_aPlanlessQuoteMatchesOnlyPlanlessRules() {
        // P2P and cash-out pass no plan and must resolve exactly as they always did.
        when(feeRuleRepository.findByTransactionTypeAndActiveTrue("MERCHANT_MDR"))
                .thenReturn(List.of(mdr(null, "1.5"), mdr("ENTERPRISE", "0.8")));

        assertEquals(0, new BigDecimal("15.00")
                .compareTo(service.quote("MERCHANT_MDR", new BigDecimal("1000.00"), null).fee()));
    }

    @Test
    void aPlanRuleStillHonoursItsCapsAndBands() {
        FeeRule capped = mdr("STANDARD", "1.5");
        capped.setMaxFee(new BigDecimal("20"));
        capped.setTierMinAmount(new BigDecimal("100"));
        when(feeRuleRepository.findByTransactionTypeAndActiveTrue("MERCHANT_MDR"))
                .thenReturn(List.of(capped));

        // Above the band, and above the cap: clamped to 20 rather than 150.
        assertEquals(0, new BigDecimal("20.00")
                .compareTo(service.quote("MERCHANT_MDR", new BigDecimal("10000.00"), null, "STANDARD").fee()));
        // Below the band entirely: no rule matches.
        assertNull(service.quote("MERCHANT_MDR", new BigDecimal("50.00"), null, "STANDARD").ruleId());
    }
}
