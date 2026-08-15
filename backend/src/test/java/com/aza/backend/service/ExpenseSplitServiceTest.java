package com.aza.backend.service;

import com.aza.backend.dto.split.BalanceResponse;
import com.aza.backend.dto.split.CreateSplitRequest;
import com.aza.backend.dto.split.SplitResponse;
import com.aza.backend.entity.*;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * A split moves no money of its own — it works out who owes what and asks through the
 * ordinary payment-request path. These tests are about the arithmetic adding up, the
 * asks going to the right people, and the rollup closing the split exactly once.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class ExpenseSplitServiceTest {

    @Autowired ExpenseSplitService service;

    @MockitoBean ExpenseSplitRepository splitRepository;
    @MockitoBean ExpenseSplitParticipantRepository participantRepository;
    @MockitoBean SplitSettlementRepository settlementRepository;
    @MockitoBean TransactionRepository transactionRepository;
    @MockitoBean BlockedUserRepository blockedUserRepository;
    @MockitoBean UserRepository userRepository;
    @MockitoBean RecipientResolver recipientResolver;
    @MockitoBean NotificationService notificationService;
    @MockitoBean StringRedisTemplate stringRedisTemplate;
    @MockitoBean RedisMessageListenerContainer redisMessageListenerContainer;

    private final UUID creatorId = UUID.randomUUID();
    private final UUID kofiId = UUID.randomUUID();
    private final UUID amaId = UUID.randomUUID();
    private final UUID yawId = UUID.randomUUID();

    /** Stands in for the participants table so saves are visible to later reads. */
    private final List<ExpenseSplitParticipant> saved = new ArrayList<>();
    private final Map<UUID, Transaction> legs = new HashMap<>();
    private final Map<UUID, ExpenseSplit> splits = new HashMap<>();
    private final Map<UUID, SplitSettlement> settlements = new HashMap<>();

    @BeforeEach
    void setUp() {
        saved.clear();
        legs.clear();
        splits.clear();
        settlements.clear();

        when(splitRepository.save(any(ExpenseSplit.class))).thenAnswer(inv -> {
            ExpenseSplit s = inv.getArgument(0);
            if (s.getId() == null) s.setId(UUID.randomUUID());
            splits.put(s.getId(), s);
            return s;
        });
        when(participantRepository.save(any(ExpenseSplitParticipant.class))).thenAnswer(inv -> {
            ExpenseSplitParticipant p = inv.getArgument(0);
            if (p.getId() == null) {
                p.setId(UUID.randomUUID());
                saved.add(p);
            }
            return p;
        });
        when(participantRepository.findAllBySplitIdOrderByCreatedAtAsc(any())).thenAnswer(inv -> saved);
        when(participantRepository.findBySplitIdAndUserId(any(), any())).thenAnswer(inv -> {
            UUID user = inv.getArgument(1);
            return saved.stream().filter(p -> p.getUserId().equals(user)).findFirst();
        });
        when(participantRepository.findByRequestTransactionId(any())).thenAnswer(inv -> {
            UUID txId = inv.getArgument(0);
            return saved.stream().filter(p -> txId.equals(p.getRequestTransactionId())).findFirst();
        });

        when(transactionRepository.save(any(Transaction.class))).thenAnswer(inv -> {
            Transaction t = inv.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            legs.put(t.getId(), t);
            return t;
        });
        when(transactionRepository.findById(any()))
                .thenAnswer(inv -> Optional.ofNullable(legs.get(inv.getArgument(0))));

        when(splitRepository.findByCreatorIdAndIdempotencyKey(any(), anyString())).thenReturn(Optional.empty());
        when(splitRepository.findById(any()))
                .thenAnswer(inv -> Optional.ofNullable(splits.get(inv.getArgument(0))));
        when(splitRepository.findByIdForUpdate(any()))
                .thenAnswer(inv -> Optional.ofNullable(splits.get(inv.getArgument(0))));

        when(settlementRepository.save(any(SplitSettlement.class))).thenAnswer(inv -> {
            SplitSettlement st = inv.getArgument(0);
            if (st.getId() == null) st.setId(UUID.randomUUID());
            settlements.put(st.getId(), st);
            return st;
        });
        when(settlementRepository.findByIdForUpdate(any()))
                .thenAnswer(inv -> Optional.ofNullable(settlements.get(inv.getArgument(0))));
        when(settlementRepository.findOpenBetween(any(), any())).thenReturn(List.of());
        when(participantRepository.findAllBySettlementId(any())).thenAnswer(inv -> {
            UUID id = inv.getArgument(0);
            return saved.stream().filter(p -> id.equals(p.getSettlementId())).toList();
        });
        when(participantRepository.findOutstanding(any(), any())).thenAnswer(inv -> {
            UUID creditor = inv.getArgument(0);
            UUID debtor = inv.getArgument(1);
            return saved.stream()
                    .filter(p -> !p.isOrganiser())
                    .filter(p -> p.getStatus() == ExpenseSplitParticipant.Status.PENDING)
                    .filter(p -> p.getUserId().equals(debtor))
                    .filter(p -> {
                        ExpenseSplit sp = splits.get(p.getSplitId());
                        return sp != null && sp.getCreatorId().equals(creditor);
                    })
                    .toList();
        });
        when(participantRepository.findAllOwedByUser(any())).thenAnswer(inv -> {
            UUID uid = inv.getArgument(0);
            List<Object[]> rows = new ArrayList<>();
            for (ExpenseSplitParticipant p : saved) {
                ExpenseSplit sp = splits.get(p.getSplitId());
                if (sp != null && !p.isOrganiser() && p.getUserId().equals(uid)
                        && p.getStatus() == ExpenseSplitParticipant.Status.PENDING) {
                    rows.add(new Object[]{sp.getCreatorId(), p});
                }
            }
            return rows;
        });
        when(participantRepository.findAllOwedToUser(any())).thenAnswer(inv -> {
            UUID uid = inv.getArgument(0);
            List<Object[]> rows = new ArrayList<>();
            for (ExpenseSplitParticipant p : saved) {
                ExpenseSplit sp = splits.get(p.getSplitId());
                if (sp != null && !p.isOrganiser() && sp.getCreatorId().equals(uid)
                        && p.getStatus() == ExpenseSplitParticipant.Status.PENDING) {
                    rows.add(new Object[]{p.getUserId(), p});
                }
            }
            return rows;
        });
        when(blockedUserRepository.existsBlockBetween(any(), any())).thenReturn(false);

        stubUser(creatorId, "Ama", "Mensah");
        stubUser(kofiId, "Kofi", "Owusu");
        stubUser(amaId, "Abena", "Boateng");
        stubUser(yawId, "Yaw", "Darko");
    }

    // ── Equal shares ──────────────────────────────────────────────────────────

    @Test
    void equalSplit_dividesEvenlyAndCountsTheOrganiser() {
        SplitResponse response = service.create(creator(), request("120.00", "EQUAL", kofiId, amaId));

        // Three people on a GHS 120 bill: 40 each, organiser included.
        assertEquals(3, saved.size());
        assertEquals(new BigDecimal("40.00"), shareOf(creatorId));
        assertEquals(new BigDecimal("40.00"), shareOf(kofiId));
        assertEquals(new BigDecimal("40.00"), shareOf(amaId));
        assertEquals("OPEN", response.getStatus());
    }

    @Test
    void equalSplit_givesTheRoundingToTheOrganiser() {
        service.create(creator(), request("100.00", "EQUAL", kofiId, amaId));

        // 100 / 3 leaves a pesewa. The person who paid the bill absorbs it, so nobody
        // else is asked for an odd number they will argue about.
        assertEquals(new BigDecimal("33.34"), shareOf(creatorId));
        assertEquals(new BigDecimal("33.33"), shareOf(kofiId));
        assertEquals(new BigDecimal("33.33"), shareOf(amaId));
        assertEquals(new BigDecimal("100.00"), totalOfShares());
    }

    /**
     * The request DTO's own minimum stops this long before the service sees it, so this
     * is the service standing on its own rather than trusting the controller: a bill
     * that cannot give everyone a pesewa is refused rather than silently asking for zero.
     */
    @Test
    void equalSplit_tooSmallToGiveEveryoneAPesewa_isRejected() {
        AppException e = assertThrows(AppException.class,
                () -> service.create(creator(), request("0.03", "EQUAL", kofiId, amaId, yawId)));
        assertEquals("AMOUNT_TOO_SMALL", e.getCode());
    }

    // ── Exact shares ──────────────────────────────────────────────────────────

    @Test
    void exactSplit_leavesTheRemainderToTheOrganiser() {
        CreateSplitRequest req = request("100.00", "EXACT", kofiId, amaId);
        req.getParticipants().get(0).setAmount(new BigDecimal("30.00"));
        req.getParticipants().get(1).setAmount(new BigDecimal("25.00"));

        service.create(creator(), req);

        assertEquals(new BigDecimal("30.00"), shareOf(kofiId));
        assertEquals(new BigDecimal("25.00"), shareOf(amaId));
        // Whatever nobody was asked for is what the organiser is standing.
        assertEquals(new BigDecimal("45.00"), shareOf(creatorId));
    }

    @Test
    void exactSplit_sharesOverTheBill_isRejected() {
        CreateSplitRequest req = request("100.00", "EXACT", kofiId, amaId);
        req.getParticipants().get(0).setAmount(new BigDecimal("70.00"));
        req.getParticipants().get(1).setAmount(new BigDecimal("60.00"));

        AppException e = assertThrows(AppException.class, () -> service.create(creator(), req));
        assertEquals("SHARES_EXCEED_TOTAL", e.getCode());
    }

    @Test
    void exactSplit_missingAnAmount_isRejected() {
        CreateSplitRequest req = request("100.00", "EXACT", kofiId, amaId);
        req.getParticipants().get(0).setAmount(new BigDecimal("30.00"));
        // second participant left without an amount

        AppException e = assertThrows(AppException.class, () -> service.create(creator(), req));
        assertEquals("SHARE_REQUIRED", e.getCode());
    }

    // ── Weighted shares ───────────────────────────────────────────────────────

    @Test
    void weightedSplit_dividesByParts_andCountsTheOrganisersOwn() {
        CreateSplitRequest req = request("120.00", "SHARES", kofiId, amaId);
        req.getParticipants().get(0).setShares(1);
        req.getParticipants().get(1).setShares(3);
        req.setOrganiserShares(2);

        service.create(creator(), req);

        // Six parts of GHS 20: organiser 2, Kofi 1, Abena 3.
        assertEquals(new BigDecimal("40.00"), shareOf(creatorId));
        assertEquals(new BigDecimal("20.00"), shareOf(kofiId));
        assertEquals(new BigDecimal("60.00"), shareOf(amaId));
        assertEquals(new BigDecimal("120.00"), totalOfShares());
    }

    @Test
    void weightedSplit_givesTheRoundingToTheOrganiser() {
        CreateSplitRequest req = request("100.00", "SHARES", kofiId, amaId);
        req.getParticipants().get(0).setShares(1);
        req.getParticipants().get(1).setShares(1);
        req.setOrganiserShares(1);

        service.create(creator(), req);

        // 100 over three parts leaves a pesewa; the person who paid absorbs it.
        assertEquals(new BigDecimal("33.33"), shareOf(kofiId));
        assertEquals(new BigDecimal("33.33"), shareOf(amaId));
        assertEquals(new BigDecimal("33.34"), shareOf(creatorId));
        assertEquals(new BigDecimal("100.00"), totalOfShares());
    }

    @Test
    void weightedSplit_missingAShareCount_isRejected() {
        CreateSplitRequest req = request("120.00", "SHARES", kofiId, amaId);
        req.getParticipants().get(0).setShares(2);

        AppException e = assertThrows(AppException.class, () -> service.create(creator(), req));
        assertEquals("SHARES_REQUIRED", e.getCode());
    }

    // ── Percentage ────────────────────────────────────────────────────────────

    @Test
    void percentageSplit_leavesTheRemainderToTheOrganiser() {
        CreateSplitRequest req = request("200.00", "PERCENTAGE", kofiId, amaId);
        req.getParticipants().get(0).setPercentage(new BigDecimal("25"));
        req.getParticipants().get(1).setPercentage(new BigDecimal("50"));

        service.create(creator(), req);

        assertEquals(new BigDecimal("50.00"), shareOf(kofiId));
        assertEquals(new BigDecimal("100.00"), shareOf(amaId));
        // The organiser keeps the 25% nobody was asked for.
        assertEquals(new BigDecimal("50.00"), shareOf(creatorId));
        assertEquals(new BigDecimal("200.00"), totalOfShares());
    }

    @Test
    void percentageSplit_overOneHundred_isRejected() {
        CreateSplitRequest req = request("200.00", "PERCENTAGE", kofiId, amaId);
        req.getParticipants().get(0).setPercentage(new BigDecimal("70"));
        req.getParticipants().get(1).setPercentage(new BigDecimal("60"));

        AppException e = assertThrows(AppException.class, () -> service.create(creator(), req));
        assertEquals("PERCENTAGES_EXCEED_TOTAL", e.getCode());
    }

    @Test
    void percentageSplit_missingAPercentage_isRejected() {
        CreateSplitRequest req = request("200.00", "PERCENTAGE", kofiId, amaId);
        req.getParticipants().get(0).setPercentage(new BigDecimal("25"));

        AppException e = assertThrows(AppException.class, () -> service.create(creator(), req));
        assertEquals("PERCENTAGE_REQUIRED", e.getCode());
    }

    // ── Who is asked ──────────────────────────────────────────────────────────

    @Test
    void create_asksEveryoneButTheOrganiser() {
        service.create(creator(), request("120.00", "EQUAL", kofiId, amaId));

        assertEquals(2, legs.size());
        // A request faces the way the money will move: the debtor sends, the organiser receives.
        assertTrue(legs.values().stream().allMatch(l -> l.getRecipientId().equals(creatorId)));
        assertTrue(legs.values().stream().allMatch(l -> Boolean.TRUE.equals(l.getIsRequest())));
        assertEquals(Set.of(kofiId, amaId),
                legs.values().stream().map(Transaction::getSenderId).collect(java.util.stream.Collectors.toSet()));
        // The organiser's own row exists but was never asked for.
        assertNull(saved.stream().filter(p -> p.getUserId().equals(creatorId))
                .findFirst().orElseThrow().getRequestTransactionId());
    }

    @Test
    void create_marksEachLegWithTheSplitSoSettlingRollsItForward() {
        SplitResponse response = service.create(creator(), request("120.00", "EQUAL", kofiId, amaId));
        UUID splitId = UUID.fromString(response.getId());

        assertTrue(legs.values().stream().allMatch(l -> splitId.equals(l.getSplitId())));
    }

    @Test
    void create_includingYourself_isRejected() {
        AppException e = assertThrows(AppException.class,
                () -> service.create(creator(), request("100.00", "EQUAL", creatorId)));
        assertEquals("SELF_INCLUDED", e.getCode());
    }

    @Test
    void create_withTheSamePersonTwice_isRejected() {
        AppException e = assertThrows(AppException.class,
                () -> service.create(creator(), request("100.00", "EQUAL", kofiId, kofiId)));
        assertEquals("DUPLICATE_PARTICIPANT", e.getCode());
    }

    @Test
    void create_withSomeoneWhoBlockedYou_isRejected() {
        when(blockedUserRepository.existsBlockBetween(creatorId, kofiId)).thenReturn(true);

        AppException e = assertThrows(AppException.class,
                () -> service.create(creator(), request("100.00", "EQUAL", kofiId)));
        assertEquals("PARTICIPANT_UNAVAILABLE", e.getCode());
    }

    @Test
    void create_replayingTheKey_returnsTheSameSplitAndAsksNobodyTwice() {
        CreateSplitRequest req = request("120.00", "EQUAL", kofiId, amaId);
        SplitResponse first = service.create(creator(), req);

        ExpenseSplit existing = splitOf(UUID.fromString(first.getId()));
        when(splitRepository.findByCreatorIdAndIdempotencyKey(creatorId, req.getIdempotencyKey()))
                .thenReturn(Optional.of(existing));

        SplitResponse second = service.create(creator(), req);

        assertEquals(first.getId(), second.getId());
        assertEquals(2, legs.size());
    }

    // ── Settling ──────────────────────────────────────────────────────────────

    @Test
    void payingAShare_marksThatPersonPaid_andLeavesTheSplitOpen() {
        SplitResponse response = service.create(creator(), request("120.00", "EQUAL", kofiId, amaId));
        ExpenseSplit split = splitOf(UUID.fromString(response.getId()));
        when(splitRepository.findByIdForUpdate(split.getId())).thenReturn(Optional.of(split));

        service.onLegSettled(paid(legFor(kofiId)));

        assertEquals(ExpenseSplitParticipant.Status.PAID, statusOf(kofiId));
        assertEquals(ExpenseSplit.Status.OPEN, split.getStatus());
    }

    @Test
    void theLastShare_settlesTheWholeSplit() {
        SplitResponse response = service.create(creator(), request("120.00", "EQUAL", kofiId, amaId));
        ExpenseSplit split = splitOf(UUID.fromString(response.getId()));
        when(splitRepository.findByIdForUpdate(split.getId())).thenReturn(Optional.of(split));

        service.onLegSettled(paid(legFor(kofiId)));
        service.onLegSettled(paid(legFor(amaId)));

        assertEquals(ExpenseSplit.Status.SETTLED, split.getStatus());
        assertNotNull(split.getSettledAt());
    }

    @Test
    void aDeclinedShare_leavesTheSplitOpenToChase() {
        SplitResponse response = service.create(creator(), request("120.00", "EQUAL", kofiId, amaId));
        ExpenseSplit split = splitOf(UUID.fromString(response.getId()));
        when(splitRepository.findByIdForUpdate(split.getId())).thenReturn(Optional.of(split));

        Transaction leg = legFor(kofiId);
        leg.setStatus(Transaction.TransactionStatus.DECLINED);
        service.onLegSettled(leg);
        service.onLegSettled(paid(legFor(amaId)));

        assertEquals(ExpenseSplitParticipant.Status.DECLINED, statusOf(kofiId));
        // A refusal is not a settlement — the organiser is still owed.
        assertEquals(ExpenseSplit.Status.OPEN, split.getStatus());
    }

    @Test
    void settlingTheSameLegTwice_doesNotSettleTheSplitEarly() {
        SplitResponse response = service.create(creator(), request("120.00", "EQUAL", kofiId, amaId));
        ExpenseSplit split = splitOf(UUID.fromString(response.getId()));
        when(splitRepository.findByIdForUpdate(split.getId())).thenReturn(Optional.of(split));

        Transaction leg = paid(legFor(kofiId));
        service.onLegSettled(leg);
        service.onLegSettled(leg);

        assertEquals(ExpenseSplit.Status.OPEN, split.getStatus());
    }

    // ── Organiser actions ─────────────────────────────────────────────────────

    @Test
    void waiving_closesTheShareAndWithdrawsTheAsk() {
        SplitResponse response = service.create(creator(), request("120.00", "EQUAL", kofiId, amaId));
        ExpenseSplit split = splitOf(UUID.fromString(response.getId()));
        when(splitRepository.findByIdForUpdate(split.getId())).thenReturn(Optional.of(split));

        UUID legId = legFor(kofiId).getId();
        service.waive(creator(), split.getId(), kofiId);

        assertEquals(ExpenseSplitParticipant.Status.WAIVED, statusOf(kofiId));
        // The ask comes off the table, so a forgiven share can't be paid from the thread.
        assertEquals(Transaction.TransactionStatus.CANCELLED, legs.get(legId).getStatus());
    }

    @Test
    void waivingTheLastOutstandingShare_settlesTheSplit() {
        SplitResponse response = service.create(creator(), request("120.00", "EQUAL", kofiId, amaId));
        ExpenseSplit split = splitOf(UUID.fromString(response.getId()));
        when(splitRepository.findByIdForUpdate(split.getId())).thenReturn(Optional.of(split));

        service.onLegSettled(paid(legFor(kofiId)));
        service.waive(creator(), split.getId(), amaId);

        assertEquals(ExpenseSplit.Status.SETTLED, split.getStatus());
    }

    @Test
    void waivingSomeoneWhoAlreadyPaid_isRejected() {
        SplitResponse response = service.create(creator(), request("120.00", "EQUAL", kofiId, amaId));
        ExpenseSplit split = splitOf(UUID.fromString(response.getId()));
        when(splitRepository.findByIdForUpdate(split.getId())).thenReturn(Optional.of(split));
        service.onLegSettled(paid(legFor(kofiId)));

        AppException e = assertThrows(AppException.class,
                () -> service.waive(creator(), split.getId(), kofiId));
        assertEquals("ALREADY_PAID", e.getCode());
    }

    @Test
    void onlyTheOrganiserMayCancel() {
        SplitResponse response = service.create(creator(), request("120.00", "EQUAL", kofiId, amaId));
        ExpenseSplit split = splitOf(UUID.fromString(response.getId()));
        when(splitRepository.findByIdForUpdate(split.getId())).thenReturn(Optional.of(split));

        AppException e = assertThrows(AppException.class,
                () -> service.cancel(user(kofiId, "Kofi", "Owusu"), split.getId()));
        assertEquals("FORBIDDEN", e.getCode());
    }

    @Test
    void cancelling_withdrawsEveryOutstandingAskButLeavesPaidSharesAlone() {
        SplitResponse response = service.create(creator(), request("120.00", "EQUAL", kofiId, amaId));
        ExpenseSplit split = splitOf(UUID.fromString(response.getId()));
        when(splitRepository.findByIdForUpdate(split.getId())).thenReturn(Optional.of(split));

        UUID kofiLeg = legFor(kofiId).getId();
        UUID amaLeg = legFor(amaId).getId();
        service.onLegSettled(paid(legFor(kofiId)));

        service.cancel(creator(), split.getId());

        assertEquals(ExpenseSplit.Status.CANCELLED, split.getStatus());
        assertEquals(ExpenseSplitParticipant.Status.PAID, statusOf(kofiId));
        assertEquals(ExpenseSplitParticipant.Status.CANCELLED, statusOf(amaId));
        // Money already paid stays paid; only the unanswered ask is withdrawn.
        assertEquals(Transaction.TransactionStatus.COMPLETED, legs.get(kofiLeg).getStatus());
        assertEquals(Transaction.TransactionStatus.CANCELLED, legs.get(amaLeg).getStatus());
    }

    // ── Netting ───────────────────────────────────────────────────────────────

    @Test
    void balances_nettsBothDirectionsIntoOneNumber() {
        // Ama organises a GHS 100 bill: Kofi owes her 50.
        service.create(creator(), exact("100.00", kofiId, "50.00"));
        // Kofi organises a GHS 60 bill: Ama owes him 30.
        service.create(user(kofiId, "Kofi", "Owusu"), exact("60.00", creatorId, "30.00"));

        List<BalanceResponse> balances = service.balances(creator());

        assertEquals(1, balances.size());
        BalanceResponse b = balances.get(0);
        assertEquals(new BigDecimal("50.00"), b.getTheyOweYou());
        assertEquals(new BigDecimal("30.00"), b.getYouOweThem());
        assertEquals(new BigDecimal("20.00"), b.getNet());
    }

    @Test
    void settleUp_replacesEveryShareWithOneRequestForTheDifference() {
        service.create(creator(), exact("100.00", kofiId, "50.00"));
        service.create(user(kofiId, "Kofi", "Owusu"), exact("60.00", creatorId, "30.00"));
        int legsBefore = legs.size();

        service.settleUp(creator(), kofiId);

        SplitSettlement settlement = settlements.values().iterator().next();
        // Kofi owed 50, Ama owed 30 — Kofi pays the 20 difference.
        assertEquals(creatorId, settlement.getCreditorId());
        assertEquals(kofiId, settlement.getDebtorId());
        assertEquals(new BigDecimal("20.00"), settlement.getAmount());

        // Both original asks are off the table, replaced by exactly one.
        assertEquals(legsBefore + 1, legs.size());
        assertEquals(2, saved.stream()
                .filter(p -> p.getStatus() == ExpenseSplitParticipant.Status.NETTED).count());
    }

    @Test
    void settleUp_directionFollowsTheArithmetic_notWhoAsked() {
        // Ama is the one who owes more, and Ama is the one pressing the button.
        service.create(creator(), exact("100.00", kofiId, "20.00"));
        service.create(user(kofiId, "Kofi", "Owusu"), exact("200.00", creatorId, "90.00"));

        service.settleUp(creator(), kofiId);

        SplitSettlement settlement = settlements.values().iterator().next();
        assertEquals(kofiId, settlement.getCreditorId());
        assertEquals(creatorId, settlement.getDebtorId());
        assertEquals(new BigDecimal("70.00"), settlement.getAmount());
    }

    @Test
    void settleUp_whenDebtsCancelExactly_nobodyPaysAnything() {
        service.create(creator(), exact("100.00", kofiId, "40.00"));
        service.create(user(kofiId, "Kofi", "Owusu"), exact("80.00", creatorId, "40.00"));
        int legsBefore = legs.size();

        service.settleUp(creator(), kofiId);

        SplitSettlement settlement = settlements.values().iterator().next();
        assertEquals(0, BigDecimal.ZERO.compareTo(settlement.getAmount()));
        assertEquals(SplitSettlement.Status.PAID, settlement.getStatus());
        // No new ask: there is nothing to ask for.
        assertEquals(legsBefore, legs.size());
        assertEquals(2, saved.stream()
                .filter(p -> p.getStatus() == ExpenseSplitParticipant.Status.PAID && !p.isOrganiser()).count());
    }

    @Test
    void nettedSharesAreNotSettled_soTheirSplitStaysOpen() {
        SplitResponse response = service.create(creator(), exact("100.00", kofiId, "50.00"));
        ExpenseSplit split = splitOf(UUID.fromString(response.getId()));

        service.settleUp(creator(), kofiId);

        // Consolidated is not paid. The money has not moved yet.
        assertEquals(ExpenseSplit.Status.OPEN, split.getStatus());
    }

    @Test
    void payingASettlement_closesEveryShareBehindIt() {
        SplitResponse response = service.create(creator(), exact("100.00", kofiId, "50.00"));
        ExpenseSplit split = splitOf(UUID.fromString(response.getId()));
        service.settleUp(creator(), kofiId);

        SplitSettlement settlement = settlements.values().iterator().next();
        Transaction netLeg = legs.get(settlement.getRequestTransactionId());
        netLeg.setStatus(Transaction.TransactionStatus.COMPLETED);

        service.onLegSettled(netLeg);

        assertEquals(SplitSettlement.Status.PAID, settlement.getStatus());
        assertEquals(ExpenseSplitParticipant.Status.PAID, statusOf(kofiId));
        assertEquals(ExpenseSplit.Status.SETTLED, split.getStatus());
    }

    @Test
    void refusingToSettleUp_putsTheSharesBack_ratherThanErasingThem() {
        service.create(creator(), exact("100.00", kofiId, "50.00"));
        service.settleUp(creator(), kofiId);

        SplitSettlement settlement = settlements.values().iterator().next();
        Transaction netLeg = legs.get(settlement.getRequestTransactionId());
        netLeg.setStatus(Transaction.TransactionStatus.DECLINED);

        service.onLegSettled(netLeg);

        assertEquals(SplitSettlement.Status.CANCELLED, settlement.getStatus());
        // Refusing to settle up is not refusing the debt.
        assertEquals(ExpenseSplitParticipant.Status.PENDING, statusOf(kofiId));
        ExpenseSplitParticipant kofi = saved.stream()
                .filter(p -> p.getUserId().equals(kofiId)).findFirst().orElseThrow();
        assertNull(kofi.getSettlementId());
        assertNotNull(kofi.getRequestTransactionId());
    }

    @Test
    void forgivingANettedShare_isRejected() {
        SplitResponse response = service.create(creator(), exact("100.00", kofiId, "50.00"));
        ExpenseSplit split = splitOf(UUID.fromString(response.getId()));
        service.settleUp(creator(), kofiId);

        AppException e = assertThrows(AppException.class,
                () -> service.waive(creator(), split.getId(), kofiId));
        // The settle-up is already collecting this money as part of a larger sum.
        assertEquals("SHARE_NETTED", e.getCode());
    }

    @Test
    void settleUp_withNothingOutstanding_isRejected() {
        AppException e = assertThrows(AppException.class, () -> service.settleUp(creator(), kofiId));
        assertEquals("NOTHING_TO_SETTLE", e.getCode());
    }

    @Test
    void settleUp_whileOneIsAlreadyWaiting_isRejected() {
        service.create(creator(), exact("100.00", kofiId, "50.00"));
        when(settlementRepository.findOpenBetween(any(), any()))
                .thenReturn(List.of(SplitSettlement.builder().id(UUID.randomUUID()).build()));

        AppException e = assertThrows(AppException.class, () -> service.settleUp(creator(), kofiId));
        assertEquals("SETTLEMENT_OPEN", e.getCode());
    }

    // ── Visibility ────────────────────────────────────────────────────────────

    @Test
    void someoneNotOnTheBill_cannotReadIt() {
        SplitResponse response = service.create(creator(), request("120.00", "EQUAL", kofiId, amaId));
        ExpenseSplit split = splitOf(UUID.fromString(response.getId()));
        when(splitRepository.findById(split.getId())).thenReturn(Optional.of(split));

        AppException e = assertThrows(AppException.class,
                () -> service.get(user(yawId, "Yaw", "Darko"), split.getId()));
        assertEquals("FORBIDDEN", e.getCode());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private ExpenseSplit splitOf(UUID id) {
        return splits.get(id);
    }

    private Transaction legFor(UUID debtorId) {
        return legs.values().stream()
                .filter(l -> l.getSenderId().equals(debtorId)).findFirst().orElseThrow();
    }

    private Transaction paid(Transaction leg) {
        leg.setStatus(Transaction.TransactionStatus.COMPLETED);
        return leg;
    }

    private BigDecimal shareOf(UUID userId) {
        return saved.stream().filter(p -> p.getUserId().equals(userId))
                .findFirst().orElseThrow().getAmountOwed();
    }

    private ExpenseSplitParticipant.Status statusOf(UUID userId) {
        return saved.stream().filter(p -> p.getUserId().equals(userId))
                .findFirst().orElseThrow().getStatus();
    }

    private BigDecimal totalOfShares() {
        return saved.stream().map(ExpenseSplitParticipant::getAmountOwed)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** An exact split where one named person owes a set amount. */
    private CreateSplitRequest exact(String total, UUID other, String owed) {
        CreateSplitRequest req = request(total, "EXACT", other);
        req.getParticipants().get(0).setAmount(new BigDecimal(owed));
        return req;
    }

    private CreateSplitRequest request(String total, String mode, UUID... people) {
        CreateSplitRequest req = new CreateSplitRequest();
        req.setTotalAmount(new BigDecimal(total));
        req.setDescription("Dinner at Santoku");
        req.setSplitMode(mode);
        req.setIdempotencyKey(UUID.randomUUID().toString());

        List<CreateSplitRequest.Participant> participants = new ArrayList<>();
        for (UUID id : people) {
            CreateSplitRequest.Participant p = new CreateSplitRequest.Participant();
            String identifier = "user-" + id;
            p.setIdentifier(identifier);
            participants.add(p);
            // Resolved outside the when(...) — a mock call nested inside a stubbing
            // makes Mockito think the stub was never finished.
            User resolved = userRepository.findById(id).orElseThrow();
            when(recipientResolver.resolve(identifier))
                    .thenReturn(new RecipientResolver.Resolution(resolved, null));
        }
        req.setParticipants(participants);
        return req;
    }

    private void stubUser(UUID id, String first, String last) {
        when(userRepository.findById(id)).thenReturn(Optional.of(user(id, first, last)));
    }

    private User creator() {
        return user(creatorId, "Ama", "Mensah");
    }

    private User user(UUID id, String first, String last) {
        return User.builder()
                .id(id).firstName(first).lastName(last)
                .status(User.AccountStatus.ACTIVE).kycStatus(User.KycStatus.VERIFIED)
                .kycTier(KycTier.TIER_3)
                .build();
    }
}
