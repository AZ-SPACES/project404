package com.aza.backend.service;

import com.aza.backend.dto.admin.FeeStatsResponse;
import com.aza.backend.entity.Transaction;
import com.aza.backend.repository.AgentRepository;
import com.aza.backend.repository.FeeRuleRepository;
import com.aza.backend.repository.TransactionRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collection;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class FeeServiceStatsTest {

    private final FeeRuleRepository feeRuleRepository = mock(FeeRuleRepository.class);
    private final TransactionRepository transactionRepository = mock(TransactionRepository.class);
    private final AgentRepository agentRepository = mock(AgentRepository.class);
    private final FeeService service = new FeeService(feeRuleRepository, transactionRepository, agentRepository);

    @Test
    void getStats_computesRevenueAverageAndDigitalRatio() {
        when(feeRuleRepository.countByActiveTrue()).thenReturn(2L);
        when(transactionRepository.sumFeeBetween(any(), any())).thenReturn(new BigDecimal("50.00"));
        when(transactionRepository.countFeeBearingBetween(any(), any())).thenReturn(10L);
        when(transactionRepository.sumCompletedAmountBetween(any(), any())).thenReturn(new BigDecimal("1000.00"));
        when(transactionRepository.sumCompletedAmountByTypesBetween(
                anyCollection(), any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(new BigDecimal("200.00")); // cash share
        when(agentRepository.sumCommissionAccrued()).thenReturn(new BigDecimal("12.34"));

        FeeStatsResponse stats = service.getStats();

        assertEquals(2L, stats.getActiveFeeRules());
        assertEquals(new BigDecimal("50.00"), stats.getTotalFeeRevenueMonth());
        assertEquals(0, stats.getAverageFeePerTransaction().compareTo(new BigDecimal("5.00"))); // 50/10
        assertEquals(0, stats.getDigitalRatioMonth().compareTo(new BigDecimal("0.8"))); // (1000-200)/1000
        assertEquals(new BigDecimal("12.34"), stats.getAgentCommissionPayable());

        // The cash bucket is queried for exactly CASH_IN + CASH_OUT.
        verify(transactionRepository).sumCompletedAmountByTypesBetween(
                argThat((Collection<Transaction.TransactionType> c) ->
                        c.contains(Transaction.TransactionType.CASH_IN)
                                && c.contains(Transaction.TransactionType.CASH_OUT)
                                && c.size() == 2),
                any(), any());
    }

    @Test
    void getStats_handlesNoActivity() {
        when(feeRuleRepository.countByActiveTrue()).thenReturn(0L);
        when(transactionRepository.sumFeeBetween(any(), any())).thenReturn(BigDecimal.ZERO);
        when(transactionRepository.countFeeBearingBetween(any(), any())).thenReturn(0L);
        when(transactionRepository.sumCompletedAmountBetween(any(), any())).thenReturn(BigDecimal.ZERO);
        when(transactionRepository.sumCompletedAmountByTypesBetween(anyCollection(), any(), any()))
                .thenReturn(BigDecimal.ZERO);
        when(agentRepository.sumCommissionAccrued()).thenReturn(BigDecimal.ZERO);

        FeeStatsResponse stats = service.getStats();

        assertEquals(0, stats.getAverageFeePerTransaction().compareTo(BigDecimal.ZERO));
        assertEquals(0, stats.getDigitalRatioMonth().compareTo(BigDecimal.ZERO)); // no divide-by-zero
    }
}
