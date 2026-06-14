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
}
