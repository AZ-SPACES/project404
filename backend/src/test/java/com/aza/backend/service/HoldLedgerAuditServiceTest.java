package com.aza.backend.service;

import com.aza.backend.entity.HoldEvent;
import com.aza.backend.entity.PaymentHold;
import com.aza.backend.entity.ReconBreak;
import com.aza.backend.repository.HoldEventRepository;
import com.aza.backend.repository.PaymentHoldRepository;
import com.aza.backend.repository.ReconBreakRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * G10: payment_holds carries running totals, hold_events is the append-only truth. They are
 * written together, so disagreement means a money bug — and one whose failure mode is
 * silent, since balances still look plausible.
 */
class HoldLedgerAuditServiceTest {

    private final PaymentHoldRepository holdRepository = mock(PaymentHoldRepository.class);
    private final HoldEventRepository eventRepository = mock(HoldEventRepository.class);
    private final ReconBreakRepository breakRepository = mock(ReconBreakRepository.class);
    private final StaffAlertService staffAlertService = mock(StaffAlertService.class);

    private final HoldLedgerAuditService service = new HoldLedgerAuditService(
            holdRepository, eventRepository, breakRepository, staffAlertService);

    private PaymentHold hold(String released, String refunded) {
        return PaymentHold.builder()
                .id(UUID.randomUUID()).sessionId(UUID.randomUUID()).merchantId(UUID.randomUUID())
                .payerUserId(UUID.randomUUID())
                .amount(new BigDecimal("250.00")).azaFee(new BigDecimal("3.75"))
                .releasedAmount(new BigDecimal(released)).refundedAmount(new BigDecimal(refunded))
                .status(PaymentHold.HoldStatus.RELEASED).build();
    }

    private HoldEvent event(UUID holdId, HoldEvent.EventType type, String amount) {
        return HoldEvent.builder().holdId(holdId).eventType(type)
                .amount(new BigDecimal(amount)).actorType(HoldEvent.ActorType.PLATFORM).build();
    }

    @Test
    void agreeingLedgerRaisesNothing() {
        PaymentHold h = hold("250.00", "0.00");
        when(holdRepository.findSettledSince(any())).thenReturn(List.of(h));
        when(eventRepository.findAllByHoldIdOrderByCreatedAtAsc(h.getId())).thenReturn(List.of(
                event(h.getId(), HoldEvent.EventType.HELD, "250.00"),      // capture, not a settlement
                event(h.getId(), HoldEvent.EventType.RELEASED, "250.00")));

        HoldLedgerAuditService.AuditResult result = service.verifyLedger();

        assertEquals(1, result.holdsChecked());
        assertEquals(0, result.breaksOpened());
        verify(breakRepository, never()).saveAll(any());
        verifyNoInteractions(staffAlertService);
    }

    @Test
    void moneyMovedWithoutBeingRecorded_opensABreakAndPagesFinance() {
        // Hold says 250 released; the event log only accounts for 200.
        PaymentHold h = hold("250.00", "0.00");
        when(holdRepository.findSettledSince(any())).thenReturn(List.of(h));
        when(eventRepository.findAllByHoldIdOrderByCreatedAtAsc(h.getId())).thenReturn(List.of(
                event(h.getId(), HoldEvent.EventType.RELEASED, "200.00")));

        HoldLedgerAuditService.AuditResult result = service.verifyLedger();

        assertEquals(1, result.breaksOpened());

        ArgumentCaptor<List<ReconBreak>> captor = ArgumentCaptor.forClass(List.class);
        verify(breakRepository).saveAll(captor.capture());
        ReconBreak b = captor.getValue().get(0);
        assertEquals(ReconBreak.BreakReason.HOLD_LEDGER_DRIFT, b.getReason());
        assertEquals(new BigDecimal("250.00"), b.getInternalAmount());
        assertEquals(new BigDecimal("200.00"), b.getStatementAmount());
        assertTrue(b.getStatementReference().contains("released"));

        verify(staffAlertService).alertRole(any(), eq("HOLD LEDGER DRIFT"), contains("1 hold"));
    }

    @Test
    void refundDriftIsCaughtToo_includingExpiryRefunds() {
        PaymentHold h = hold("0.00", "250.00");
        when(holdRepository.findSettledSince(any())).thenReturn(List.of(h));
        // Expiry refunds count toward the refunded total; here only half is logged.
        when(eventRepository.findAllByHoldIdOrderByCreatedAtAsc(h.getId())).thenReturn(List.of(
                event(h.getId(), HoldEvent.EventType.EXPIRED_REFUNDED, "125.00")));

        assertEquals(1, service.verifyLedger().breaksOpened());
    }

    @Test
    void scanIsBounded_soTheNightlyJobDoesNotGrowWithEveryHoldEverSettled() {
        when(holdRepository.findSettledSince(any())).thenReturn(List.of());

        service.verifyLedger();

        ArgumentCaptor<LocalDateTime> since = ArgumentCaptor.forClass(LocalDateTime.class);
        verify(holdRepository).findSettledSince(since.capture());
        // Window must comfortably exceed the 90-day maximum hold life, so a hold that can
        // still move is never outside it.
        assertTrue(since.getValue().isBefore(LocalDateTime.now().minusDays(90)),
                "audit window must outlast the longest possible hold");
    }

    @Test
    void partialReleaseAcrossSeveralEventsReconciles() {
        PaymentHold h = hold("250.00", "0.00");
        when(holdRepository.findSettledSince(any())).thenReturn(List.of(h));
        when(eventRepository.findAllByHoldIdOrderByCreatedAtAsc(h.getId())).thenReturn(List.of(
                event(h.getId(), HoldEvent.EventType.RELEASED, "80.00"),
                event(h.getId(), HoldEvent.EventType.RELEASED, "170.00")));

        assertEquals(0, service.verifyLedger().breaksOpened());
    }
}
