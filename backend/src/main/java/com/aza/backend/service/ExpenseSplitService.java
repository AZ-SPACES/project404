package com.aza.backend.service;

import com.aza.backend.dto.split.CreateSplitRequest;
import com.aza.backend.dto.split.SplitResponse;
import com.aza.backend.entity.*;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.*;
import com.aza.backend.util.RateLimitService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Splitting a bill somebody already paid.
 *
 * The organiser settled with the restaurant; this works out who owes them what and asks
 * for it. Each share is created as an ordinary money request — the same PENDING
 * {@link Transaction} the app already surfaces on the home screen and in the chat payment
 * sheet. That is the whole point of the design: a share is accepted with the same
 * passcode and checked against the same limits as any other request, so splitting a bill
 * never becomes a second way to move money.
 *
 * Nothing here touches a wallet. A split is a ledger of intent laid over transfers that
 * either happen or don't, which is why it has no safeguarding consequences of its own.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ExpenseSplitService {

    private final ExpenseSplitRepository splitRepository;
    private final ExpenseSplitParticipantRepository participantRepository;
    private final TransactionRepository transactionRepository;
    private final BlockedUserRepository blockedUserRepository;
    private final UserRepository userRepository;
    private final RecipientResolver recipientResolver;
    private final NotificationService notificationService;
    private final RateLimitService rateLimitService;

    private static final BigDecimal MIN_SHARE = new BigDecimal("0.01");

    // ==================== CREATE ====================

    @Transactional
    public SplitResponse create(User creator, CreateSplitRequest req) {
        // Replaying the key returns the split it already made rather than asking
        // everyone for their share a second time.
        Optional<ExpenseSplit> replay =
                splitRepository.findByCreatorIdAndIdempotencyKey(creator.getId(), req.getIdempotencyKey());
        if (replay.isPresent()) {
            return toResponse(replay.get(), creator.getId());
        }

        if (creator.getStatus() != User.AccountStatus.ACTIVE) {
            throw new AppException("Your account is not active");
        }
        if (creator.getKycStatus() != User.KycStatus.VERIFIED) {
            throw new AppException("KYC verification required before splitting a bill");
        }
        rateLimitService.enforceRateLimit("split:create:" + creator.getId(), 20, Duration.ofHours(1));

        ExpenseSplit.SplitMode mode = parseMode(req.getSplitMode());
        BigDecimal total = req.getTotalAmount().setScale(2, RoundingMode.HALF_UP);

        List<User> others = resolveParticipants(creator, req.getParticipants());
        // The organiser is a participant too — they ate as well. Their share is recorded
        // so the arithmetic adds up, and never asked for, because they already paid.
        int shareCount = others.size() + 1;

        List<BigDecimal> shares = mode == ExpenseSplit.SplitMode.EQUAL
                ? equalShares(total, shareCount)
                : exactShares(total, req.getParticipants(), others.size());

        ExpenseSplit split = splitRepository.save(ExpenseSplit.builder()
                .creatorId(creator.getId())
                .idempotencyKey(req.getIdempotencyKey())
                .totalAmount(total)
                .description(req.getDescription().trim())
                .splitMode(mode)
                .status(ExpenseSplit.Status.OPEN)
                .build());

        // The organiser's row: settled on arrival, with nothing to pay.
        participantRepository.save(ExpenseSplitParticipant.builder()
                .splitId(split.getId())
                .userId(creator.getId())
                .amountOwed(shares.get(0))
                .organiser(true)
                .status(ExpenseSplitParticipant.Status.PAID)
                .settledAt(LocalDateTime.now())
                .build());

        for (int i = 0; i < others.size(); i++) {
            User participant = others.get(i);
            BigDecimal owed = shares.get(i + 1);
            Transaction leg = askForShare(creator, participant, owed, split);

            participantRepository.save(ExpenseSplitParticipant.builder()
                    .splitId(split.getId())
                    .userId(participant.getId())
                    .amountOwed(owed)
                    .organiser(false)
                    .status(ExpenseSplitParticipant.Status.PENDING)
                    .requestTransactionId(leg.getId())
                    .build());
        }

        log.info("Split created: id={}, creator={}, total={}, mode={}, people={}",
                split.getId(), creator.getId(), total, mode, shareCount);

        return toResponse(split, creator.getId());
    }

    /**
     * Ask one person for their share.
     *
     * The ask is an ordinary money request — the same PENDING request row the app already
     * shows on the home screen, in the transaction list, and in the chat payment sheet.
     * That is the point: a share is accepted with the same passcode and checked against
     * the same limits as any other request, and no new way to move money is introduced.
     */
    private Transaction askForShare(User creator, User participant, BigDecimal owed, ExpenseSplit split) {
        Transaction leg = transactionRepository.save(Transaction.builder()
                // A request is stored facing the way the money will eventually move:
                // the person who owes is the sender, the organiser is the recipient.
                .senderId(participant.getId())
                .recipientId(creator.getId())
                .recipientType(Transaction.RecipientType.USER)
                .amount(owed)
                .note(split.getDescription())
                .type(Transaction.TransactionType.REQUEST)
                .status(Transaction.TransactionStatus.PENDING)
                .isRequest(true)
                .requestedAt(LocalDateTime.now())
                .splitId(split.getId())
                .idempotencyKey("split:" + split.getId() + ":" + participant.getId())
                .build());

        notificationService.sendNotification(
                participant.getId(),
                Notification.NotificationType.MONEY_REQUESTED,
                "Your share of \"" + split.getDescription() + "\"",
                displayName(creator) + " asked you for GHS " + owed.toPlainString() + ".",
                // Carried so the app can open the split, not just the request behind it.
                Map.of("splitId", split.getId().toString(), "requestId", leg.getId().toString()),
                owed);

        return leg;
    }

    // ==================== SHARE ARITHMETIC ====================

    /**
     * Divide evenly, and give the organiser the rounding.
     *
     * GHS 100 three ways is 33.33 each with a pesewa left over. Handing it to the person
     * who paid the bill keeps every other share a round, arguable-with-nobody number,
     * and costs the organiser at most a pesewa per head.
     */
    private List<BigDecimal> equalShares(BigDecimal total, int people) {
        BigDecimal base = total.divide(BigDecimal.valueOf(people), 2, RoundingMode.DOWN);
        if (base.compareTo(MIN_SHARE) < 0) {
            throw new AppException("AMOUNT_TOO_SMALL",
                    "GHS " + total.toPlainString() + " doesn't divide " + people
                            + " ways — everyone needs at least GHS 0.01.",
                    HttpStatus.BAD_REQUEST);
        }
        BigDecimal remainder = total.subtract(base.multiply(BigDecimal.valueOf(people)));

        List<BigDecimal> shares = new ArrayList<>(people);
        shares.add(base.add(remainder)); // index 0 is always the organiser
        for (int i = 1; i < people; i++) {
            shares.add(base);
        }
        return shares;
    }

    /**
     * Take the organiser's word for each share, and check it adds up.
     *
     * Whatever the named people are not asked for is the organiser's own share — so the
     * amounts must never exceed the bill, and the remainder falls to them.
     */
    private List<BigDecimal> exactShares(BigDecimal total, List<CreateSplitRequest.Participant> asked, int count) {
        List<BigDecimal> shares = new ArrayList<>(count + 1);
        shares.add(BigDecimal.ZERO); // organiser's slot, filled in below

        BigDecimal named = BigDecimal.ZERO;
        for (int i = 0; i < count; i++) {
            BigDecimal amount = asked.get(i).getAmount();
            if (amount == null) {
                throw new AppException("SHARE_REQUIRED",
                        "An exact split needs an amount for everyone.", HttpStatus.BAD_REQUEST);
            }
            BigDecimal scaled = amount.setScale(2, RoundingMode.HALF_UP);
            named = named.add(scaled);
            shares.add(scaled);
        }

        if (named.compareTo(total) > 0) {
            throw new AppException("SHARES_EXCEED_TOTAL",
                    "Those shares add up to GHS " + named.toPlainString()
                            + ", more than the GHS " + total.toPlainString() + " bill.",
                    HttpStatus.BAD_REQUEST);
        }
        shares.set(0, total.subtract(named));
        return shares;
    }

    // ==================== PARTICIPANTS ====================

    private List<User> resolveParticipants(User creator, List<CreateSplitRequest.Participant> asked) {
        List<User> resolved = new ArrayList<>(asked.size());
        Set<UUID> seen = new HashSet<>();

        for (CreateSplitRequest.Participant p : asked) {
            RecipientResolver.Resolution resolution = recipientResolver.resolve(p.getIdentifier());
            if (!resolution.payable()) {
                throw new AppException("PARTICIPANT_UNPAYABLE",
                        p.getIdentifier() + ": " + resolution.problem().reason, HttpStatus.BAD_REQUEST);
            }
            User user = resolution.user();

            if (user.getId().equals(creator.getId())) {
                throw new AppException("SELF_INCLUDED",
                        "You're already counted — add only the people who owe you.", HttpStatus.BAD_REQUEST);
            }
            if (!seen.add(user.getId())) {
                throw new AppException("DUPLICATE_PARTICIPANT",
                        displayName(user) + " is on the list twice.", HttpStatus.BAD_REQUEST);
            }
            if (blockedUserRepository.existsBlockBetween(creator.getId(), user.getId())) {
                throw new AppException("PARTICIPANT_UNAVAILABLE",
                        "You can't split a bill with " + displayName(user) + ".", HttpStatus.FORBIDDEN);
            }
            resolved.add(user);
        }
        return resolved;
    }

    // ==================== SETTLEMENT ====================

    /**
     * Called by {@link PaymentRequestService} whenever a request that belongs to a split
     * reaches a final state. The split's own status is a rollup of its legs, and this is
     * the only thing that moves it.
     *
     * Taking the split's row lock matters: two people can pay their shares in the same
     * instant, and both then ask whether that was the last one outstanding.
     */
    @Transactional
    public void onLegSettled(Transaction leg) {
        if (leg.getSplitId() == null) return;

        ExpenseSplit split = splitRepository.findByIdForUpdate(leg.getSplitId()).orElse(null);
        if (split == null) {
            log.warn("Request {} points at split {} which no longer exists",
                    leg.getId(), leg.getSplitId());
            return;
        }

        ExpenseSplitParticipant participant =
                participantRepository.findByRequestTransactionId(leg.getId()).orElse(null);
        if (participant == null) {
            log.warn("Request {} belongs to split {} but matches no participant",
                    leg.getId(), split.getId());
            return;
        }

        ExpenseSplitParticipant.Status settled = switch (leg.getStatus()) {
            case COMPLETED -> ExpenseSplitParticipant.Status.PAID;
            case DECLINED -> ExpenseSplitParticipant.Status.DECLINED;
            case CANCELLED, FAILED, REVERSED -> ExpenseSplitParticipant.Status.CANCELLED;
            default -> null;
        };
        if (settled == null || participant.getStatus() == settled) return;

        participant.setStatus(settled);
        participant.setSettledAt(LocalDateTime.now());
        participantRepository.save(participant);

        if (settled == ExpenseSplitParticipant.Status.PAID) {
            log.info("Split {} — {} paid their share of {}",
                    split.getId(), participant.getUserId(), participant.getAmountOwed());
        }
        rollUp(split);
    }

    /** A split is settled once nothing is left to chase. */
    private void rollUp(ExpenseSplit split) {
        if (split.getStatus() != ExpenseSplit.Status.OPEN) return;

        List<ExpenseSplitParticipant> everyone =
                participantRepository.findAllBySplitIdOrderByCreatedAtAsc(split.getId());
        boolean outstanding = everyone.stream().anyMatch(p -> !p.isClosed());
        if (outstanding) return;

        split.setStatus(ExpenseSplit.Status.SETTLED);
        split.setSettledAt(LocalDateTime.now());
        splitRepository.save(split);

        notificationService.sendNotification(
                split.getCreatorId(),
                Notification.NotificationType.MONEY_RECEIVED,
                "Everyone has settled up",
                "\"" + split.getDescription() + "\" is fully paid.",
                null, split.getTotalAmount());

        log.info("Split {} fully settled", split.getId());
    }

    // ==================== ORGANISER ACTIONS ====================

    /** Forgive one person's share. It counts as settled and they are not asked again. */
    @Transactional
    public SplitResponse waive(User creator, UUID splitId, UUID userId) {
        ExpenseSplit split = organiserSplit(creator, splitId);

        ExpenseSplitParticipant participant = participantRepository
                .findBySplitIdAndUserId(splitId, userId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "They aren't in this split.", HttpStatus.NOT_FOUND));
        if (participant.isOrganiser()) {
            throw new AppException("CANNOT_WAIVE_SELF", "You already paid the bill.", HttpStatus.BAD_REQUEST);
        }
        if (participant.getStatus() == ExpenseSplitParticipant.Status.PAID) {
            throw new AppException("ALREADY_PAID", "They already paid their share.", HttpStatus.CONFLICT);
        }

        withdrawLeg(participant);
        participant.setStatus(ExpenseSplitParticipant.Status.WAIVED);
        participant.setSettledAt(LocalDateTime.now());
        participantRepository.save(participant);

        notificationService.sendNotification(
                userId,
                Notification.NotificationType.PAYMENT_REQUEST_CANCELLED,
                "Share forgiven",
                displayName(creator) + " cleared your share of \"" + split.getDescription() + "\".",
                null, participant.getAmountOwed());

        rollUp(split);
        return toResponse(split, creator.getId());
    }

    /** Call the whole thing off. Everyone still owing is let go. */
    @Transactional
    public SplitResponse cancel(User creator, UUID splitId) {
        ExpenseSplit split = organiserSplit(creator, splitId);
        if (split.getStatus() == ExpenseSplit.Status.SETTLED) {
            throw new AppException("ALREADY_SETTLED",
                    "This split is already paid up.", HttpStatus.CONFLICT);
        }

        for (ExpenseSplitParticipant p : participantRepository.findAllBySplitIdOrderByCreatedAtAsc(splitId)) {
            if (p.isClosed()) continue;
            withdrawLeg(p);
            p.setStatus(ExpenseSplitParticipant.Status.CANCELLED);
            p.setSettledAt(LocalDateTime.now());
            participantRepository.save(p);

            notificationService.sendNotification(
                    p.getUserId(),
                    Notification.NotificationType.PAYMENT_REQUEST_CANCELLED,
                    "Split cancelled",
                    displayName(creator) + " called off \"" + split.getDescription() + "\".",
                    null, p.getAmountOwed());
        }

        split.setStatus(ExpenseSplit.Status.CANCELLED);
        split.setCancelledAt(LocalDateTime.now());
        splitRepository.save(split);

        log.info("Split {} cancelled by {}", splitId, creator.getId());
        return toResponse(split, creator.getId());
    }

    /** Nudge everyone who still owes. */
    @Transactional
    public SplitResponse remind(User creator, UUID splitId) {
        ExpenseSplit split = organiserSplit(creator, splitId);
        rateLimitService.enforceRateLimit("split:remind:" + splitId, 3, Duration.ofDays(1));

        for (ExpenseSplitParticipant p : participantRepository.findAllBySplitIdOrderByCreatedAtAsc(splitId)) {
            if (p.isClosed() || p.isOrganiser()) continue;
            notificationService.sendPaymentRequestReceivedNotification(
                    p.getUserId(), displayName(creator), p.getAmountOwed(),
                    p.getRequestTransactionId() != null
                            ? p.getRequestTransactionId().toString() : splitId.toString());
        }
        return toResponse(split, creator.getId());
    }

    /**
     * Take the ask off the table. The request stops being payable, so a forgiven or
     * cancelled share cannot be paid by someone scrolling back through their thread.
     */
    private void withdrawLeg(ExpenseSplitParticipant participant) {
        if (participant.getRequestTransactionId() == null) return;
        transactionRepository.findById(participant.getRequestTransactionId()).ifPresent(leg -> {
            if (leg.getStatus() == Transaction.TransactionStatus.PENDING) {
                leg.setStatus(Transaction.TransactionStatus.CANCELLED);
                leg.setCancelledAt(LocalDateTime.now());
                transactionRepository.save(leg);
            }
        });
    }

    private ExpenseSplit organiserSplit(User creator, UUID splitId) {
        ExpenseSplit split = splitRepository.findByIdForUpdate(splitId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Split not found", HttpStatus.NOT_FOUND));
        if (!split.getCreatorId().equals(creator.getId())) {
            throw new AppException("FORBIDDEN", "Only the organiser can do that.", HttpStatus.FORBIDDEN);
        }
        return split;
    }

    // ==================== QUERIES ====================

    @Transactional(readOnly = true)
    public SplitResponse get(User viewer, UUID splitId) {
        ExpenseSplit split = splitRepository.findById(splitId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Split not found", HttpStatus.NOT_FOUND));
        // A bill is only the business of the people on it.
        if (participantRepository.findBySplitIdAndUserId(splitId, viewer.getId()).isEmpty()) {
            throw new AppException("FORBIDDEN", "You're not part of this split.", HttpStatus.FORBIDDEN);
        }
        return toResponse(split, viewer.getId());
    }

    @Transactional(readOnly = true)
    public Page<SplitResponse> listMine(User viewer, int page, int size) {
        return splitRepository
                .findAllForUser(viewer.getId(), PageRequest.of(page, Math.min(size, 50)))
                .map(s -> toResponse(s, viewer.getId()));
    }

    // ==================== MAPPING ====================

    SplitResponse toResponse(ExpenseSplit split, UUID viewerId) {
        List<ExpenseSplitParticipant> everyone =
                participantRepository.findAllBySplitIdOrderByCreatedAtAsc(split.getId());

        Map<UUID, User> users = new HashMap<>();
        for (ExpenseSplitParticipant p : everyone) {
            userRepository.findById(p.getUserId()).ifPresent(u -> users.put(u.getId(), u));
        }
        User creator = users.get(split.getCreatorId());

        BigDecimal outstanding = everyone.stream()
                .filter(p -> !p.isClosed())
                .map(ExpenseSplitParticipant::getAmountOwed)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        int paid = (int) everyone.stream()
                .filter(p -> p.getStatus() == ExpenseSplitParticipant.Status.PAID)
                .count();

        ExpenseSplitParticipant mine = everyone.stream()
                .filter(p -> p.getUserId().equals(viewerId))
                .findFirst().orElse(null);

        return SplitResponse.builder()
                .id(split.getId().toString())
                .description(split.getDescription())
                .totalAmount(split.getTotalAmount())
                .currency(split.getCurrency())
                .splitMode(split.getSplitMode().name())
                .status(split.getStatus().name())
                .creatorId(split.getCreatorId().toString())
                .creatorName(creator != null ? displayName(creator) : "Someone")
                .creatorHandle(creator != null ? creator.getUsername() : null)
                .creatorAvatarUrl(creator != null ? creator.getProfileImageUrl() : null)
                .createdAt(split.getCreatedAt())
                .settledAt(split.getSettledAt())
                .organisedByMe(split.getCreatorId().equals(viewerId))
                .myShare(mine != null && !mine.isOrganiser() && !mine.isClosed() ? mine.getAmountOwed() : null)
                .myStatus(mine != null ? mine.getStatus().name() : null)
                .myRequestId(mine != null && mine.getRequestTransactionId() != null && !mine.isClosed()
                        ? mine.getRequestTransactionId().toString() : null)
                .outstandingAmount(outstanding)
                .paidCount(paid)
                .participantCount(everyone.size())
                .participants(everyone.stream().map(p -> {
                    User u = users.get(p.getUserId());
                    return SplitResponse.ParticipantInfo.builder()
                            .userId(p.getUserId().toString())
                            .name(u != null ? displayName(u) : "Someone")
                            .handle(u != null ? u.getUsername() : null)
                            .avatarUrl(u != null ? u.getProfileImageUrl() : null)
                            .amountOwed(p.getAmountOwed())
                            .status(p.getStatus().name())
                            .organiser(p.isOrganiser())
                            .requestId(p.getRequestTransactionId() != null
                                    ? p.getRequestTransactionId().toString() : null)
                            .settledAt(p.getSettledAt())
                            .build();
                }).toList())
                .build();
    }

    // ==================== HELPERS ====================

    private static ExpenseSplit.SplitMode parseMode(String raw) {
        if (raw == null || raw.isBlank()) return ExpenseSplit.SplitMode.EQUAL;
        try {
            return ExpenseSplit.SplitMode.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException("INVALID_SPLIT_MODE",
                    "Split mode must be EQUAL or EXACT", HttpStatus.BAD_REQUEST);
        }
    }

    private static String displayName(User u) {
        String first = u.getFirstName() != null ? u.getFirstName() : "";
        String last = u.getLastName() != null ? u.getLastName() : "";
        String name = (first + " " + last).trim();
        return name.isEmpty() ? "Someone" : name;
    }
}
