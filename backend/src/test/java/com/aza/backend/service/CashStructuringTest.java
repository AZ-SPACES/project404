package com.aza.backend.service;

import com.aza.backend.entity.FlaggedTransaction;
import com.aza.backend.entity.Transaction;
import com.aza.backend.repository.FlaggedTransactionRepository;
import com.aza.backend.repository.RiskAlertRepository;
import com.aza.backend.repository.RiskDecisionLogRepository;
import com.aza.backend.repository.TransactionRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CashStructuringTest {

    private final RiskRuleService riskRuleService = mock(RiskRuleService.class);
    private final FlaggedTransactionRepository flaggedRepository = mock(FlaggedTransactionRepository.class);
    private final RiskAlertRepository riskAlertRepository = mock(RiskAlertRepository.class);
    private final TransactionRepository transactionRepository = mock(TransactionRepository.class);
    private final StaffAlertService staffAlertService = mock(StaffAlertService.class);
    private final RiskDecisionLogRepository decisionLogRepository = mock(RiskDecisionLogRepository.class);

    private final RiskEngineService service = new RiskEngineService(
            riskRuleService, flaggedRepository, riskAlertRepository,
            transactionRepository, staffAlertService, decisionLogRepository);

    private final UUID customerId = UUID.randomUUID();

    private Transaction cashIn(String amount) {
        return Transaction.builder()
                .id(UUID.randomUUID())
                .type(Transaction.TransactionType.CASH_IN)
                .status(Transaction.TransactionStatus.COMPLETED)
                .amount(new BigDecimal(amount))
                .senderId(UUID.randomUUID()).recipientId(customerId)
                .build();
    }

    @Test
    void flagsRepeatedSubThresholdDeposits() {
        when(riskRuleService.largeTransferThresholdGhs()).thenReturn(new BigDecimal("1000"));
        when(transactionRepository.countCashInDepositsInBand(eq(customerId), any(), any(), any()))
                .thenReturn(3L);

        service.evaluateCashActivity(cashIn("800"), customerId); // in 700–1000 band

        verify(flaggedRepository).save(argThat(f ->
                f.getFlagReason().contains("cash structuring") && f.getUserId().equals(customerId)));
        verify(riskAlertRepository).save(any());
        verify(staffAlertService).alertRole(any(), anyString(), anyString());
    }

    @Test
    void doesNotFlagBelowCount() {
        when(riskRuleService.largeTransferThresholdGhs()).thenReturn(new BigDecimal("1000"));
        when(transactionRepository.countCashInDepositsInBand(any(), any(), any(), any())).thenReturn(1L);

        service.evaluateCashActivity(cashIn("800"), customerId);

        verify(flaggedRepository, never()).save(any(FlaggedTransaction.class));
    }

    @Test
    void doesNotQueryOutsideBand() {
        when(riskRuleService.largeTransferThresholdGhs()).thenReturn(new BigDecimal("1000"));

        service.evaluateCashActivity(cashIn("500"), customerId); // below the 700 band floor

        verify(transactionRepository, never()).countCashInDepositsInBand(any(), any(), any(), any());
        verify(flaggedRepository, never()).save(any(FlaggedTransaction.class));
    }
}
