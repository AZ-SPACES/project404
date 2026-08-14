package com.aza.backend.service;

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

    @BeforeEach
    void setUp() {
        saved.clear();
        legs.clear();
        splits.clear();

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
