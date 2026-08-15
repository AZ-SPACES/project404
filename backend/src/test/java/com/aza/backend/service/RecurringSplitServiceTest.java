package com.aza.backend.service;

import com.aza.backend.dto.split.CreateSplitRequest;
import com.aza.backend.entity.*;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Rent splits are the ones people actually live with, so the failure that matters is
 * producing two of them for the same month — or none, because one housemate moved out.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class RecurringSplitServiceTest {

    @Autowired RecurringSplitService service;

    @MockitoBean RecurringSplitRepository recurringRepository;
    @MockitoBean RecurringSplitParticipantRepository participantRepository;
    @MockitoBean UserRepository userRepository;
    @MockitoBean ExpenseSplitService expenseSplitService;
    @MockitoBean RecipientResolver recipientResolver;
    @MockitoBean BlockedUserRepository blockedUserRepository;
    @MockitoBean StringRedisTemplate stringRedisTemplate;
    @MockitoBean RedisMessageListenerContainer redisMessageListenerContainer;

    private final UUID creatorId = UUID.randomUUID();
    private final UUID kofiId = UUID.randomUUID();
    private final UUID amaId = UUID.randomUUID();

    private final Map<UUID, RecurringSplit> stored = new HashMap<>();
    private final List<RecurringSplitParticipant> standing = new ArrayList<>();

    @BeforeEach
    void setUp() {
        stored.clear();
        standing.clear();

        when(recurringRepository.save(any(RecurringSplit.class))).thenAnswer(inv -> {
            RecurringSplit r = inv.getArgument(0);
            if (r.getId() == null) r.setId(UUID.randomUUID());
            stored.put(r.getId(), r);
            return r;
        });
        when(recurringRepository.findById(any()))
                .thenAnswer(inv -> Optional.ofNullable(stored.get(inv.getArgument(0))));
        when(participantRepository.save(any(RecurringSplitParticipant.class))).thenAnswer(inv -> {
            RecurringSplitParticipant p = inv.getArgument(0);
            if (p.getId() == null) p.setId(UUID.randomUUID());
            standing.add(p);
            return p;
        });
        when(participantRepository.findAllByRecurringSplitId(any())).thenAnswer(inv -> {
            UUID id = inv.getArgument(0);
            return standing.stream().filter(p -> p.getRecurringSplitId().equals(id)).toList();
        });
        when(blockedUserRepository.existsBlockBetween(any(), any())).thenReturn(false);

        stubUser(creatorId, "Ama", "Mensah");
        stubUser(kofiId, "Kofi", "Owusu");
        stubUser(amaId, "Abena", "Boateng");
    }

    // ── Setting one up ────────────────────────────────────────────────────────

    @Test
    @DisplayName("a monthly split holds its people by id, not by handle")
    void participantsAreHeldById() {
        service.create(creator(), request(), "MONTHLY", 1);

        assertEquals(2, standing.size());
        assertEquals(Set.of(kofiId, amaId),
                standing.stream().map(RecurringSplitParticipant::getUserId)
                        .collect(java.util.stream.Collectors.toSet()));
    }

    @Test
    @DisplayName("a day past the 28th is refused so a rent split never skips February")
    void monthlyDayIsCappedAt28() {
        AppException e = assertThrows(AppException.class,
                () -> service.create(creator(), request(), "MONTHLY", 31));
        assertEquals("INVALID_DAY", e.getCode());
    }

    @Test
    @DisplayName("including yourself is refused")
    void selfIsRefused() {
        CreateSplitRequest req = request();
        req.getParticipants().get(0).setIdentifier("user-" + creatorId);
        when(recipientResolver.resolve("user-" + creatorId))
                .thenReturn(new RecipientResolver.Resolution(creator(), null));

        AppException e = assertThrows(AppException.class,
                () -> service.create(creator(), req, "MONTHLY", 1));
        assertEquals("SELF_INCLUDED", e.getCode());
    }

    // ── The run ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("a due split produces an ordinary split and moves the clock on a month")
    void dueProducesASplitAndAdvances() {
        RecurringSplit r = due(LocalDate.now().withDayOfMonth(1), RecurringSplit.Frequency.MONTHLY);

        assertEquals(1, service.runDue(LocalDate.now()));

        verify(expenseSplitService).createFor(any(), any(), anyList());
        assertEquals(r.getLastRunOn().plusMonths(1), r.getNextRunOn());
    }

    @Test
    @DisplayName("the run is keyed by period, so firing twice makes one month's split")
    void theKeyCarriesThePeriod() {
        RecurringSplit r = due(LocalDate.now().withDayOfMonth(1), RecurringSplit.Frequency.MONTHLY);
        LocalDate period = r.getNextRunOn();

        service.runDue(LocalDate.now());

        ArgumentCaptor<CreateSplitRequest> captor = ArgumentCaptor.forClass(CreateSplitRequest.class);
        verify(expenseSplitService).createFor(any(), captor.capture(), anyList());
        // The underlying create refuses a duplicate of this key, so a second fire for the
        // same month finds the split it already made instead of asking everyone twice.
        assertTrue(captor.getValue().getIdempotencyKey()
                .endsWith(":" + period.format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd"))));
    }

    @Test
    @DisplayName("months missed while the server was down are skipped, not replayed")
    void missedPeriodsAreSkipped() {
        RecurringSplit r = due(LocalDate.now().minusMonths(3).withDayOfMonth(1),
                RecurringSplit.Frequency.MONTHLY);

        service.runDue(LocalDate.now());

        // One split for catching up, and the clock lands in the future rather than
        // grinding through every month that was missed.
        verify(expenseSplitService, times(1)).createFor(any(), any(), anyList());
        assertTrue(r.getNextRunOn().isAfter(LocalDate.now()));
    }

    @Test
    @DisplayName("a housemate who left is skipped, and everyone else still gets asked")
    void inactiveParticipantsAreSkipped() {
        due(LocalDate.now(), RecurringSplit.Frequency.MONTHLY);
        when(userRepository.findById(kofiId)).thenReturn(Optional.of(
                User.builder().id(kofiId).firstName("Kofi").lastName("Owusu")
                        .status(User.AccountStatus.SUSPENDED).build()));

        service.runDue(LocalDate.now());

        ArgumentCaptor<List<User>> people = ArgumentCaptor.forClass(List.class);
        verify(expenseSplitService).createFor(any(), any(), people.capture());
        assertEquals(1, people.getValue().size());
        assertEquals(amaId, people.getValue().get(0).getId());
    }

    @Test
    @DisplayName("one broken definition does not stop the others running")
    void oneFailureDoesNotStopTheRest() {
        RecurringSplit broken = due(LocalDate.now(), RecurringSplit.Frequency.MONTHLY);
        RecurringSplit fine = due(LocalDate.now(), RecurringSplit.Frequency.MONTHLY);
        when(recurringRepository.findDue(any())).thenReturn(List.of(broken, fine));
        when(expenseSplitService.createFor(any(), any(), anyList()))
                .thenThrow(new AppException("boom"))
                .thenReturn(null);

        assertEquals(1, service.runDue(LocalDate.now()));
        // Both clocks moved on; a definition that fails every minute for a month helps
        // nobody and buries the log.
        assertTrue(broken.getNextRunOn().isAfter(LocalDate.now()));
        assertTrue(fine.getNextRunOn().isAfter(LocalDate.now()));
    }

    @Test
    @DisplayName("a suspended organiser stops asking their housemates for rent")
    void suspendedOrganiserDoesNotRun() {
        due(LocalDate.now(), RecurringSplit.Frequency.MONTHLY);
        when(userRepository.findById(creatorId)).thenReturn(Optional.of(
                User.builder().id(creatorId).status(User.AccountStatus.SUSPENDED).build()));

        assertEquals(0, service.runDue(LocalDate.now()));
        verify(expenseSplitService, never()).createFor(any(), any(), anyList());
    }

    // ── Management ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("pausing keeps the people, and resuming does not replay missed months")
    void pauseAndResume() {
        RecurringSplit r = due(LocalDate.now().minusMonths(2), RecurringSplit.Frequency.MONTHLY);
        r.setDayOfPeriod(1);

        service.setActive(creator(), r.getId(), false);
        assertFalse(r.isActive());
        assertFalse(standing.isEmpty());

        service.setActive(creator(), r.getId(), true);
        assertTrue(r.isActive());
        assertFalse(r.getNextRunOn().isBefore(LocalDate.now()));
    }

    @Test
    @DisplayName("only the owner can touch it")
    void onlyTheOwnerMayManage() {
        RecurringSplit r = due(LocalDate.now(), RecurringSplit.Frequency.MONTHLY);
        User someoneElse = User.builder().id(kofiId).status(User.AccountStatus.ACTIVE).build();

        AppException e = assertThrows(AppException.class,
                () -> service.setActive(someoneElse, r.getId(), false));
        assertEquals("FORBIDDEN", e.getCode());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** A stored definition already due to run, with two people standing on it. */
    private RecurringSplit due(LocalDate nextRun, RecurringSplit.Frequency freq) {
        RecurringSplit r = recurringRepository.save(RecurringSplit.builder()
                .creatorId(creatorId)
                .description("October rent")
                .totalAmount(new BigDecimal("1500.00"))
                .splitMode(ExpenseSplit.SplitMode.EQUAL)
                .frequency(freq)
                .dayOfPeriod(nextRun.getDayOfMonth() > 28 ? 28 : nextRun.getDayOfMonth())
                .nextRunOn(nextRun)
                .active(true)
                .build());
        for (UUID id : List.of(kofiId, amaId)) {
            participantRepository.save(RecurringSplitParticipant.builder()
                    .recurringSplitId(r.getId()).userId(id).build());
        }
        when(recurringRepository.findDue(any())).thenReturn(new ArrayList<>(List.of(r)));
        return r;
    }

    private CreateSplitRequest request() {
        CreateSplitRequest req = new CreateSplitRequest();
        req.setTotalAmount(new BigDecimal("1500.00"));
        req.setDescription("Rent");
        req.setSplitMode("EQUAL");
        req.setIdempotencyKey(UUID.randomUUID().toString());

        List<CreateSplitRequest.Participant> participants = new ArrayList<>();
        for (UUID id : List.of(kofiId, amaId)) {
            CreateSplitRequest.Participant p = new CreateSplitRequest.Participant();
            String identifier = "user-" + id;
            p.setIdentifier(identifier);
            participants.add(p);
            User resolved = userRepository.findById(id).orElseThrow();
            when(recipientResolver.resolve(identifier))
                    .thenReturn(new RecipientResolver.Resolution(resolved, null));
        }
        req.setParticipants(participants);
        return req;
    }

    private void stubUser(UUID id, String first, String last) {
        when(userRepository.findById(id)).thenReturn(Optional.of(
                User.builder().id(id).firstName(first).lastName(last)
                        .status(User.AccountStatus.ACTIVE)
                        .kycStatus(User.KycStatus.VERIFIED)
                        .build()));
    }

    private User creator() {
        return User.builder()
                .id(creatorId).firstName("Ama").lastName("Mensah")
                .status(User.AccountStatus.ACTIVE).kycStatus(User.KycStatus.VERIFIED)
                .build();
    }
}
