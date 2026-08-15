package com.aza.backend.service;

import com.aza.backend.entity.SafeguardingSnapshot;
import com.aza.backend.entity.User;
import com.aza.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * G1: held money is in no wallet and no merchant balance. If the safeguarding variance
 * ignores it, every open hold reads as a surplus and a real breach of exactly that size
 * goes undetected.
 */
class SafeguardingHeldFloatTest {

    private final SafeguardingSnapshotRepository snapshotRepository = mock(SafeguardingSnapshotRepository.class);
    private final ReconBreakRepository breakRepository = mock(ReconBreakRepository.class);
    private final WalletRepository walletRepository = mock(WalletRepository.class);
    private final MerchantRepository merchantRepository = mock(MerchantRepository.class);
    private final TransactionRepository transactionRepository = mock(TransactionRepository.class);
    private final AdminAuditService auditService = mock(AdminAuditService.class);
    private final StaffAlertService staffAlertService = mock(StaffAlertService.class);
    private final PaymentHoldRepository paymentHoldRepository = mock(PaymentHoldRepository.class);
    private final RedEnvelopeRepository redEnvelopeRepository = mock(RedEnvelopeRepository.class);
    private final BillPaymentRepository billPaymentRepository = mock(BillPaymentRepository.class);

    private final ReconciliationService service = new ReconciliationService(
            snapshotRepository, breakRepository, walletRepository, merchantRepository,
            transactionRepository, auditService, staffAlertService, paymentHoldRepository,
            redEnvelopeRepository, billPaymentRepository);

    @BeforeEach
    void stubs() {
        when(snapshotRepository.save(any(SafeguardingSnapshot.class))).thenAnswer(i -> i.getArgument(0));
        when(walletRepository.sumFloatForAgentStatus(any())).thenReturn(BigDecimal.ZERO);
        when(redEnvelopeRepository.sumOpenEnvelopeFloat()).thenReturn(BigDecimal.ZERO);
        when(billPaymentRepository.sumPendingBillFloat()).thenReturn(BigDecimal.ZERO);
    }

    private User admin() {
        return User.builder().id(UUID.randomUUID()).build();
    }

    @Test
    void heldFloatCountsAgainstTheSafeguardedBalance() {
        when(walletRepository.sumTotalBalance()).thenReturn(new BigDecimal("600.00"));
        when(merchantRepository.sumTotalMerchantBalance()).thenReturn(new BigDecimal("100.00"));
        when(paymentHoldRepository.sumActiveHeldFloat()).thenReturn(new BigDecimal("250.00"));

        SafeguardingSnapshot snapshot = service.takeSnapshot(admin(), new BigDecimal("1000.00"));

        assertEquals(new BigDecimal("250.00"), snapshot.getHeldFloat());
        // 1000 − 600 − 100 − 250 = 50, not the 300 the old formula reported.
        assertEquals(new BigDecimal("50.00"), snapshot.getVariance());
        assertFalse(snapshot.isBreach());
    }

    @Test
    void aBreachHiddenOnlyByHeldMoneyIsNowDetected() {
        // Wallets + merchant balances alone look fine (1000 − 900 = +100), but 250 sits in
        // holds. The old formula reported a surplus; the truth is a 150 shortfall.
        when(walletRepository.sumTotalBalance()).thenReturn(new BigDecimal("800.00"));
        when(merchantRepository.sumTotalMerchantBalance()).thenReturn(new BigDecimal("100.00"));
        when(paymentHoldRepository.sumActiveHeldFloat()).thenReturn(new BigDecimal("250.00"));

        SafeguardingSnapshot snapshot = service.takeSnapshot(admin(), new BigDecimal("1000.00"));

        assertEquals(new BigDecimal("-150.00"), snapshot.getVariance());
        assertTrue(snapshot.isBreach(), "a shortfall caused by held money must raise a breach");
        verify(staffAlertService).alertRole(any(), eq("SAFEGUARDING BREACH"), contains("held 250.00"));
    }

    @Test
    void noHolds_behavesExactlyAsBefore() {
        when(walletRepository.sumTotalBalance()).thenReturn(new BigDecimal("600.00"));
        when(merchantRepository.sumTotalMerchantBalance()).thenReturn(new BigDecimal("100.00"));
        when(paymentHoldRepository.sumActiveHeldFloat()).thenReturn(BigDecimal.ZERO);

        SafeguardingSnapshot snapshot = service.takeSnapshot(admin(), new BigDecimal("1000.00"));

        assertEquals(new BigDecimal("300.00"), snapshot.getVariance());
        assertEquals(BigDecimal.ZERO, snapshot.getHeldFloat());
    }

    /**
     * Money in open Akyede envelopes is held on the same terms as a payment hold —
     * debited from the sender, credited to nobody — so it has to land in the same line.
     */
    @Test
    void openRedEnvelopesCountAsHeldFloatToo() {
        when(walletRepository.sumTotalBalance()).thenReturn(new BigDecimal("600.00"));
        when(merchantRepository.sumTotalMerchantBalance()).thenReturn(new BigDecimal("100.00"));
        when(paymentHoldRepository.sumActiveHeldFloat()).thenReturn(new BigDecimal("150.00"));
        when(redEnvelopeRepository.sumOpenEnvelopeFloat()).thenReturn(new BigDecimal("100.00"));

        SafeguardingSnapshot snapshot = service.takeSnapshot(admin(), new BigDecimal("1000.00"));

        assertEquals(new BigDecimal("250.00"), snapshot.getHeldFloat());
        assertEquals(new BigDecimal("50.00"), snapshot.getVariance());
        assertFalse(snapshot.isBreach());
    }

    @Test
    void aBreachHiddenOnlyByOpenEnvelopesIsDetected() {
        when(walletRepository.sumTotalBalance()).thenReturn(new BigDecimal("800.00"));
        when(merchantRepository.sumTotalMerchantBalance()).thenReturn(new BigDecimal("100.00"));
        when(paymentHoldRepository.sumActiveHeldFloat()).thenReturn(BigDecimal.ZERO);
        when(redEnvelopeRepository.sumOpenEnvelopeFloat()).thenReturn(new BigDecimal("250.00"));

        SafeguardingSnapshot snapshot = service.takeSnapshot(admin(), new BigDecimal("1000.00"));

        assertEquals(new BigDecimal("-150.00"), snapshot.getVariance());
        assertTrue(snapshot.isBreach(), "unclaimed envelope money is still an obligation");
    }
}
