package com.aza.backend.service;

import com.aza.backend.dto.split.CreateSplitRequest;
import com.aza.backend.dto.split.RecurringSplitResponse;
import com.aza.backend.entity.*;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.*;
import com.aza.backend.util.RateLimitService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Bills that get split the same way every month.
 *
 * The definition is stored once; on schedule it produces an ordinary {@link ExpenseSplit}
 * with no idea it came from here, so netting, reminders, and settling up all work on it
 * without knowing this exists.
 *
 * The run is keyed by period rather than by clock time. A scheduler that fires twice, or
 * a server that was down on the first of the month and catches up on the second, must
 * produce one rent split for that month and not two — so the idempotency key carries the
 * period, and the underlying create refuses a duplicate on its own.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RecurringSplitService {

    private final RecurringSplitRepository recurringRepository;
    private final RecurringSplitParticipantRepository participantRepository;
    private final UserRepository userRepository;
    private final ExpenseSplitService expenseSplitService;
    private final RecipientResolver recipientResolver;
    private final BlockedUserRepository blockedUserRepository;
    private final RateLimitService rateLimitService;

    private static final DateTimeFormatter PERIOD_KEY = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    // ==================== CREATE ====================

    @Transactional
    public RecurringSplitResponse create(User creator, CreateSplitRequest req, String frequency, Integer dayOfPeriod) {
        if (creator.getKycStatus() != User.KycStatus.VERIFIED) {
            throw new AppException("KYC verification required before splitting a bill");
        }
        rateLimitService.enforceRateLimit("split:recurring:" + creator.getId(), 10, Duration.ofHours(1));

        RecurringSplit.Frequency freq = parseFrequency(frequency);
        int day = validDay(freq, dayOfPeriod);

        // Resolved once, here, and then held by id. Doing it every month would break the
        // split the day one of them changed their handle.
        List<User> people = new ArrayList<>();
        Set<UUID> seen = new HashSet<>();
        for (CreateSplitRequest.Participant p : req.getParticipants()) {
            RecipientResolver.Resolution resolution = recipientResolver.resolve(p.getIdentifier());
            if (!resolution.payable()) {
                throw new AppException("PARTICIPANT_UNPAYABLE",
                        p.getIdentifier() + ": " + resolution.problem().reason, HttpStatus.BAD_REQUEST);
            }
            User u = resolution.user();
            if (u.getId().equals(creator.getId())) {
                throw new AppException("SELF_INCLUDED",
                        "You're already counted — add only the people who owe you.", HttpStatus.BAD_REQUEST);
            }
            if (!seen.add(u.getId())) {
                throw new AppException("DUPLICATE_PARTICIPANT",
                        "Somebody is on the list twice.", HttpStatus.BAD_REQUEST);
            }
            if (blockedUserRepository.existsBlockBetween(creator.getId(), u.getId())) {
                throw new AppException("PARTICIPANT_UNAVAILABLE",
                        "You can't split a bill with one of these people.", HttpStatus.FORBIDDEN);
            }
            people.add(u);
        }

        RecurringSplit recurring = recurringRepository.save(RecurringSplit.builder()
                .creatorId(creator.getId())
                .description(req.getDescription().trim())
                .totalAmount(req.getTotalAmount().setScale(2, RoundingMode.HALF_UP))
                .splitMode(parseMode(req.getSplitMode()))
                .frequency(freq)
                .dayOfPeriod(day)
                .nextRunOn(firstRun(freq, day))
                .active(true)
                .build());

        for (int i = 0; i < people.size(); i++) {
            CreateSplitRequest.Participant p = req.getParticipants().get(i);
            participantRepository.save(RecurringSplitParticipant.builder()
                    .recurringSplitId(recurring.getId())
                    .userId(people.get(i).getId())
                    .amount(p.getAmount())
                    .shares(p.getShares())
                    .percentage(p.getPercentage())
                    .build());
        }

        log.info("Recurring split created: id={}, creator={}, every {} on day {}, first run {}",
                recurring.getId(), creator.getId(), freq, day, recurring.getNextRunOn());

        return toResponse(recurring);
    }

    // ==================== THE RUN ====================

    /**
     * Produce the splits that are due.
     *
     * Each one runs on its own so a definition whose participant closed their account
     * does not stop the rest of the month's rent splits from going out.
     */
    @Transactional
    public int runDue(LocalDate on) {
        List<RecurringSplit> due = recurringRepository.findDue(on);
        int made = 0;

        for (RecurringSplit recurring : due) {
            try {
                runOne(recurring, on);
                made++;
            } catch (Exception e) {
                log.error("Recurring split {} failed to run for {}", recurring.getId(), on, e);
                // Advanced anyway: retrying a broken definition every minute for a month
                // would bury the log and change nothing.
                advance(recurring, on);
            }
        }
        if (!due.isEmpty()) {
            log.info("Recurring splits: {} of {} produced for {}", made, due.size(), on);
        }
        return made;
    }

    private void runOne(RecurringSplit recurring, LocalDate on) {
        User creator = userRepository.findById(recurring.getCreatorId())
                .orElseThrow(() -> new AppException("Creator no longer exists"));
        if (creator.getStatus() != User.AccountStatus.ACTIVE) {
            // Verified when it was set up, but an account can be suspended since. A
            // suspended person should not still be asking their housemates for rent.
            throw new AppException("Creator's account is not active");
        }

        List<RecurringSplitParticipant> standing =
                participantRepository.findAllByRecurringSplitId(recurring.getId());
        if (standing.isEmpty()) {
            throw new AppException("Recurring split has nobody on it");
        }

        CreateSplitRequest req = new CreateSplitRequest();
        req.setTotalAmount(recurring.getTotalAmount());
        req.setDescription(recurring.getDescription());
        req.setSplitMode(recurring.getSplitMode().name());
        // Carries the period, so a double fire or a late catch-up produces one split for
        // the month rather than two.
        req.setIdempotencyKey("recurring:" + recurring.getId() + ":"
                + recurring.getNextRunOn().format(PERIOD_KEY));

        List<User> people = new ArrayList<>();
        List<CreateSplitRequest.Participant> participants = new ArrayList<>();
        for (RecurringSplitParticipant p : standing) {
            User u = userRepository.findById(p.getUserId()).orElse(null);
            if (u == null || u.getStatus() != User.AccountStatus.ACTIVE) {
                // One person leaving does not cancel everyone else's rent.
                log.warn("Recurring split {} skipping inactive participant {}",
                        recurring.getId(), p.getUserId());
                continue;
            }
            CreateSplitRequest.Participant into = new CreateSplitRequest.Participant();
            into.setIdentifier(u.getId().toString());
            into.setAmount(p.getAmount());
            into.setShares(p.getShares());
            into.setPercentage(p.getPercentage());
            participants.add(into);
            people.add(u);
        }
        if (people.isEmpty()) {
            throw new AppException("Nobody on this recurring split is still active");
        }
        req.setParticipants(participants);

        expenseSplitService.createFor(creator, req, people);
        advance(recurring, on);
    }

    /** Move the clock forward, skipping any periods that were missed entirely. */
    private void advance(RecurringSplit recurring, LocalDate on) {
        LocalDate next = recurring.getNextRunOn();
        do {
            next = recurring.getFrequency() == RecurringSplit.Frequency.WEEKLY
                    ? next.plusWeeks(1)
                    : next.plusMonths(1);
        } while (!next.isAfter(on));

        recurring.setLastRunOn(recurring.getNextRunOn());
        recurring.setNextRunOn(next);
        recurringRepository.save(recurring);
    }

    // ==================== MANAGEMENT ====================

    @Transactional(readOnly = true)
    public List<RecurringSplitResponse> listMine(User user) {
        return recurringRepository.findAllByCreatorIdOrderByCreatedAtDesc(user.getId())
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public RecurringSplitResponse setActive(User user, UUID id, boolean active) {
        RecurringSplit recurring = own(user, id);
        recurring.setActive(active);
        if (active && recurring.getNextRunOn().isBefore(LocalDate.now())) {
            // Coming back from a pause should not fire off every month that was missed.
            recurring.setNextRunOn(firstRun(recurring.getFrequency(), recurring.getDayOfPeriod()));
        }
        recurringRepository.save(recurring);
        return toResponse(recurring);
    }

    @Transactional
    public void delete(User user, UUID id) {
        RecurringSplit recurring = own(user, id);
        participantRepository.deleteAllByRecurringSplitId(recurring.getId());
        recurringRepository.delete(recurring);
        log.info("Recurring split {} deleted by {}", id, user.getId());
    }

    private RecurringSplit own(User user, UUID id) {
        RecurringSplit recurring = recurringRepository.findById(id)
                .orElseThrow(() -> new AppException("NOT_FOUND", "No such recurring split.", HttpStatus.NOT_FOUND));
        if (!recurring.getCreatorId().equals(user.getId())) {
            throw new AppException("FORBIDDEN", "That isn't yours.", HttpStatus.FORBIDDEN);
        }
        return recurring;
    }

    // ==================== HELPERS ====================

    /** The next occurrence of this day, today included. */
    static LocalDate firstRun(RecurringSplit.Frequency freq, int day) {
        LocalDate today = LocalDate.now();
        if (freq == RecurringSplit.Frequency.WEEKLY) {
            LocalDate candidate = today.with(java.time.temporal.TemporalAdjusters.nextOrSame(
                    java.time.DayOfWeek.of(day)));
            return candidate;
        }
        LocalDate candidate = today.withDayOfMonth(day);
        return candidate.isBefore(today) ? candidate.plusMonths(1) : candidate;
    }

    private static int validDay(RecurringSplit.Frequency freq, Integer day) {
        int d = day == null ? (freq == RecurringSplit.Frequency.WEEKLY ? 1 : LocalDate.now().getDayOfMonth()) : day;
        if (freq == RecurringSplit.Frequency.WEEKLY) {
            if (d < 1 || d > 7) {
                throw new AppException("INVALID_DAY", "Pick a day of the week.", HttpStatus.BAD_REQUEST);
            }
            return d;
        }
        if (d < 1 || d > 28) {
            // Capped at 28 so a rent split does not silently skip February.
            throw new AppException("INVALID_DAY",
                    "Pick a day from 1 to 28, so it lands every month.", HttpStatus.BAD_REQUEST);
        }
        return d;
    }

    private static RecurringSplit.Frequency parseFrequency(String raw) {
        if (raw == null || raw.isBlank()) return RecurringSplit.Frequency.MONTHLY;
        try {
            return RecurringSplit.Frequency.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException("INVALID_FREQUENCY",
                    "Frequency must be WEEKLY or MONTHLY.", HttpStatus.BAD_REQUEST);
        }
    }

    private static ExpenseSplit.SplitMode parseMode(String raw) {
        if (raw == null || raw.isBlank()) return ExpenseSplit.SplitMode.EQUAL;
        try {
            return ExpenseSplit.SplitMode.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException("INVALID_SPLIT_MODE",
                    "Split mode must be EQUAL, EXACT, SHARES, or PERCENTAGE", HttpStatus.BAD_REQUEST);
        }
    }

    RecurringSplitResponse toResponse(RecurringSplit r) {
        List<RecurringSplitParticipant> standing =
                participantRepository.findAllByRecurringSplitId(r.getId());
        return RecurringSplitResponse.builder()
                .id(r.getId().toString())
                .description(r.getDescription())
                .totalAmount(r.getTotalAmount())
                .currency(r.getCurrency())
                .splitMode(r.getSplitMode().name())
                .frequency(r.getFrequency().name())
                .dayOfPeriod(r.getDayOfPeriod())
                .nextRunOn(r.getNextRunOn())
                .lastRunOn(r.getLastRunOn())
                .active(r.isActive())
                .participants(standing.stream().map(p -> {
                    User u = userRepository.findById(p.getUserId()).orElse(null);
                    return RecurringSplitResponse.ParticipantInfo.builder()
                            .userId(p.getUserId().toString())
                            .name(u != null ? displayName(u) : "Someone")
                            .handle(u != null ? u.getUsername() : null)
                            .avatarUrl(u != null ? u.getProfileImageUrl() : null)
                            .amount(p.getAmount())
                            .shares(p.getShares())
                            .percentage(p.getPercentage())
                            .build();
                }).toList())
                .build();
    }

    private static String displayName(User u) {
        String first = u.getFirstName() != null ? u.getFirstName() : "";
        String last = u.getLastName() != null ? u.getLastName() : "";
        String name = (first + " " + last).trim();
        return name.isEmpty() ? "Someone" : name;
    }
}
