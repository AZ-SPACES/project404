package com.aza.backend.service;

import com.aza.backend.entity.HoldEvent;
import com.aza.backend.entity.PaymentHold;
import com.aza.backend.entity.ReconBreak;
import com.aza.backend.repository.HoldEventRepository;
import com.aza.backend.repository.PaymentHoldRepository;
import com.aza.backend.repository.ReconBreakRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

/**
 * Nightly tripwire on the hold ledger (HELD_SETTLEMENT_PLAN G10).
 *
 * {@code payment_holds} carries running totals; {@code hold_events} is the append-only
 * record of what actually settled. They are written in the same transaction, so they can
 * only disagree if something is wrong — a release that credited wallets without updating
 * the hold, a double-count, a hand-edited row. Either direction is a money bug, and the
 * failure mode is silent: balances still look plausible, they are just no longer explained
 * by the audit trail anyone would consult after the fact.
 *
 * A drift opens a {@link ReconBreak} and pages finance rather than attempting a repair —
 * guessing which of the two records is right is how a reconciliation bug becomes a
 * reconciliation incident.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class HoldLedgerAuditService {

    private static final Set<HoldEvent.EventType> RELEASE_EVENTS =
            EnumSet.of(HoldEvent.EventType.RELEASED, HoldEvent.EventType.RELEASE_FAILED);
    private static final Set<HoldEvent.EventType> REFUND_EVENTS =
            EnumSet.of(HoldEvent.EventType.REFUNDED, HoldEvent.EventType.EXPIRED_REFUNDED);

    private final PaymentHoldRepository holdRepository;
    private final HoldEventRepository eventRepository;
    private final ReconBreakRepository breakRepository;
    private final StaffAlertService staffAlertService;

    /**
     * Window bounded on {@code heldAt}, not on when a hold resolved: a partially released
     * hold is still HELD with no resolvedAt, and its running totals can drift exactly like a
     * finished one's. The window must comfortably exceed the maximum hold life (90 days) so
     * every hold that could still move is checked while it is still actionable.
     */
    private static final int AUDIT_WINDOW_DAYS = 180;

    @Transactional
    public AuditResult verifyLedger() {
        List<PaymentHold> settled = holdRepository.findSettledSince(
                LocalDateTime.now().minusDays(AUDIT_WINDOW_DAYS));
        List<ReconBreak> breaks = new ArrayList<>();

        for (PaymentHold hold : settled) {
            List<HoldEvent> events = eventRepository.findAllByHoldIdOrderByCreatedAtAsc(hold.getId());

            BigDecimal releasedInEvents = sum(events, RELEASE_EVENTS);
            BigDecimal refundedInEvents = sum(events, REFUND_EVENTS);

            if (releasedInEvents.compareTo(hold.getReleasedAmount()) != 0) {
                breaks.add(drift(hold, "released", hold.getReleasedAmount(), releasedInEvents));
            }
            if (refundedInEvents.compareTo(hold.getRefundedAmount()) != 0) {
                breaks.add(drift(hold, "refunded", hold.getRefundedAmount(), refundedInEvents));
            }
        }

        if (!breaks.isEmpty()) {
            breakRepository.saveAll(breaks);
            log.error("HOLD LEDGER DRIFT: {} discrepancy/ies between payment_holds and hold_events", breaks.size());
            staffAlertService.alertRole(com.aza.backend.entity.StaffRole.Role.FINANCE,
                    "HOLD LEDGER DRIFT",
                    breaks.size() + " hold(s) have settled totals that disagree with their event log. "
                            + "Held funds may have moved without being recorded, or been recorded without "
                            + "moving. Do not release or refund the affected holds until reconciled.");
        }

        log.info("Hold ledger audit: {} settled hold(s) checked, {} break(s)", settled.size(), breaks.size());
        return new AuditResult(settled.size(), breaks.size());
    }

    private BigDecimal sum(List<HoldEvent> events, Set<HoldEvent.EventType> types) {
        return events.stream()
                .filter(e -> types.contains(e.getEventType()))
                .map(e -> e.getAmount() == null ? BigDecimal.ZERO : e.getAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private ReconBreak drift(PaymentHold hold, String field, BigDecimal onHold, BigDecimal inEvents) {
        return ReconBreak.builder()
                .importLabel("hold-ledger-audit")
                .statementReference("hold:" + hold.getId() + ":" + field)
                .statementAmount(inEvents)
                .internalAmount(onHold)
                .direction(ReconBreak.Direction.DEBIT)
                .reason(ReconBreak.BreakReason.HOLD_LEDGER_DRIFT)
                .status(ReconBreak.Status.OPEN)
                .build();
    }

    public record AuditResult(int holdsChecked, int breaksOpened) {}
}
