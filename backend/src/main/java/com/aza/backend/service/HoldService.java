package com.aza.backend.service;

import com.aza.backend.dto.merchant.*;
import com.aza.backend.entity.*;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Payment holds: money debited from a payer at checkout confirmation and settled later,
 * when the integrating platform authorizes it.
 *
 * Aza has no view into what the money was for and never rules on whether it was earned.
 * The integrator calls {@link #release} or {@link #refund}; Aza executes and records
 * payment facts in {@code hold_events}. See HELD_SETTLEMENT_PLAN.md §5.
 *
 * Locking, in this order on every mutating path:
 *   1. the hold row (FOR UPDATE) — serialises release vs refund vs expiry
 *   2. the merchant row
 *   3. recipient wallets, sorted by user id
 *   4. the payer wallet
 * Deviating deadlocks against the existing refund path, which sorts the same way.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class HoldService {

    private final PaymentHoldRepository holdRepository;
    private final HoldRecipientRepository recipientRepository;
    private final HoldEventRepository eventRepository;
    private final CheckoutSessionRepository sessionRepository;
    private final MerchantRepository merchantRepository;
    private final WalletRepository walletRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final WalletLedger walletLedger;
    private final RecipientResolver recipientResolver;
    private final NotificationService notificationService;

    /** Default ceiling on how long Aza will sit on a payer's money. */
    public static final int DEFAULT_MAX_HOLD_DAYS = 30;
    public static final int MAX_HOLD_DAYS_CEILING = 90;

    // ==================== CAPTURE ====================

    /**
     * Create the hold at payment confirmation. The payer has already been debited by the
     * caller; this records where the money went and what is owed to whom.
     *
     * The Aza fee is quoted here, against the merchant's rate at capture, so a later rate
     * change cannot alter what this hold owes.
     */
    @Transactional
    public PaymentHold capture(CheckoutSession session, Merchant merchant, UUID payerUserId,
                               BigDecimal azaFee, List<CheckoutSessionSplit> splits) {
        int holdDays = session.getMaxHoldDays() != null ? session.getMaxHoldDays() : DEFAULT_MAX_HOLD_DAYS;

        PaymentHold hold = holdRepository.save(PaymentHold.builder()
                .sessionId(session.getId())
                .merchantId(merchant.getId())
                .payerUserId(payerUserId)
                .amount(session.getAmount())
                .azaFee(azaFee)
                .status(PaymentHold.HoldStatus.HELD)
                .expiresAt(LocalDateTime.now().plusDays(holdDays))
                .testMode(Boolean.TRUE.equals(session.getTestMode()))
                .build());

        for (CheckoutSessionSplit split : splits) {
            recipientRepository.save(HoldRecipient.builder()
                    .holdId(hold.getId())
                    .userId(split.getRecipientUserId())
                    .identifier(split.getRecipientIdentifier())
                    .amount(split.getAmount())
                    .note(split.getNote())
                    .status(HoldRecipient.Status.PENDING)
                    .build());
        }

        recordEvent(hold, HoldEvent.EventType.HELD, session.getAmount(),
                HoldEvent.ActorType.PLATFORM, null, null, null, null);

        log.info("Hold created: holdId={}, sessionId={}, merchantId={}, amount={}, recipients={}, expiresAt={}",
                hold.getId(), session.getId(), merchant.getId(), hold.getAmount(), splits.size(), hold.getExpiresAt());
        return hold;
    }

    // ==================== RELEASE ====================

    /**
     * Pay out held money: recipients get their share, the merchant keeps the remainder
     * net of the Aza fee.
     *
     * A recipient who cannot be paid does NOT fall back to the platform — that would hand
     * the integrator money a worker earned. Their share stays held and
     * {@code hold.release_failed} is emitted for ops to chase.
     */
    @Transactional
    public PaymentHold release(UUID sessionId, UUID merchantId, ReleaseHoldRequest request,
                               String idempotencyKey, UUID apiKeyId) {
        PaymentHold hold = lockHoldForSettlement(sessionId, merchantId);

        HoldEvent replay = findReplay(hold, idempotencyKey);
        if (replay != null) return hold;

        BigDecimal remaining = remainingOf(hold);
        List<HoldRecipient> recipients = recipientRepository.findAllByHoldId(hold.getId());

        // Which recipients, and how much each — either the requested subset or everything pending.
        Map<UUID, BigDecimal> payouts = resolveRequestedPayouts(request, recipients);

        BigDecimal totalRequested = payouts.values().stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (totalRequested.compareTo(remaining) > 0) {
            throw new AppException("RELEASE_EXCEEDS_HELD",
                    "Release of GHS " + totalRequested + " exceeds the GHS " + remaining + " still held",
                    HttpStatus.BAD_REQUEST);
        }

        Merchant merchant = merchantRepository.findByIdForUpdate(merchantId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND));

        BigDecimal releasedNow = BigDecimal.ZERO;
        List<String> failures = new ArrayList<>();

        // Recipient wallets locked in user-id order — same convention as refundSession.
        List<HoldRecipient> ordered = recipients.stream()
                .filter(r -> payouts.containsKey(r.getId()))
                .sorted(Comparator.comparing(HoldRecipient::getUserId))
                .toList();

        for (HoldRecipient recipient : ordered) {
            BigDecimal payout = payouts.get(recipient.getId());
            RecipientResolver.Resolution resolution = recipientResolver.resolve(recipient.getIdentifier());

            if (!resolution.payable()) {
                // No fallback to the platform: the money stays held.
                recipient.setStatus(HoldRecipient.Status.RELEASE_FAILED);
                recipient.setFailureReason(resolution.problem().reason);
                recipientRepository.save(recipient);
                failures.add(recipient.getIdentifier() + ": " + resolution.problem().reason);
                continue;
            }

            if (Boolean.TRUE.equals(hold.getTestMode())) {
                recipient.setReleasedAmount(recipient.getReleasedAmount().add(payout));
                recipient.setStatus(statusFor(recipient));
                recipientRepository.save(recipient);
                releasedNow = releasedNow.add(payout);
                continue;
            }

            Wallet wallet = walletRepository.findByUserIdForUpdate(recipient.getUserId())
                    .orElseThrow(() -> new AppException("RECIPIENT_UNPAYABLE",
                            "Recipient wallet vanished during release", HttpStatus.CONFLICT));
            walletLedger.creditLocked(wallet, payout);

            User recipientUser = resolution.user();

            Transaction tx = transactionRepository.save(Transaction.builder()
                    .senderId(merchant.getUserId())
                    .recipientId(recipient.getUserId())
                    .amount(payout)
                    .note(recipient.getNote() != null && !recipient.getNote().isBlank()
                            ? recipient.getNote()
                            : "Released by " + merchant.getBusinessName())
                    .type(Transaction.TransactionType.TRANSFER)
                    .status(Transaction.TransactionStatus.COMPLETED)
                    .idempotencyKey("hold-release:" + recipient.getId() + ":" + hold.getReleasedAmount())
                    .completedAt(LocalDateTime.now())
                    .build());

            recipient.setReleasedAmount(recipient.getReleasedAmount().add(payout));
            recipient.setStatus(statusFor(recipient));
            recipient.setTransactionId(tx.getId());
            recipient.setFailureReason(null);
            recipientRepository.save(recipient);
            releasedNow = releasedNow.add(payout);

            notificationService.sendNotification(
                    recipient.getUserId(),
                    Notification.NotificationType.MONEY_RECEIVED,
                    "Money Received",
                    merchant.getBusinessName() + " released " + merchant.getCurrency() + " " + payout + " to you",
                    null);
        }

        // A release is "final" when every recipient obligation is now settled and nothing
        // failed. Only then does the merchant take its remainder and the Aza fee come off
        // — a partial release pays recipients and leaves the rest held, so the platform
        // cannot draw its margin before the work it is holding against is done.
        boolean allRecipientsSettled = recipientRepository.findAllByHoldId(hold.getId()).stream()
                .allMatch(r -> r.getStatus() == HoldRecipient.Status.RELEASED
                        || r.getStatus() == HoldRecipient.Status.REFUNDED);
        boolean finalRelease = failures.isEmpty() && allRecipientsSettled;

        BigDecimal platformShare = BigDecimal.ZERO;
        BigDecimal settledNow = releasedNow;

        if (finalRelease) {
            // Whatever is left after the recipients and the fee is the integrator's margin.
            platformShare = remaining.subtract(releasedNow).subtract(feeFor(hold, remaining));
            if (platformShare.signum() < 0) platformShare = BigDecimal.ZERO;
            settledNow = remaining;   // fee leaves circulation with the rest of the hold

            if (!Boolean.TRUE.equals(hold.getTestMode())) {
                if (platformShare.signum() > 0) {
                    merchant.setBalance(merchant.getBalance().add(platformShare));
                    merchant.setTotalVolume(merchant.getTotalVolume().add(hold.getAmount()));
                    merchantRepository.save(merchant);
                }
                // The Aza fee is earned here, not at capture — a refunded hold returns it
                // in full. Booking it on the capture transaction now (rather than writing a
                // second payment row) keeps one transaction per payment; the fee dashboard
                // reads feeAmount, so revenue appears only once a hold actually settles.
                BigDecimal feeEarned = feeFor(hold, remaining);
                if (feeEarned.signum() > 0) {
                    sessionRepository.findById(hold.getSessionId())
                            .map(CheckoutSession::getTransactionId)
                            .flatMap(transactionRepository::findById)
                            .ifPresent(captureTx -> {
                                captureTx.setFeeAmount(feeEarned);
                                transactionRepository.save(captureTx);
                            });
                }
            }
        }

        hold.setReleasedAmount(hold.getReleasedAmount().add(settledNow));
        hold.setStatus(statusAfterSettlement(hold));
        if (!hold.isActive()) hold.setResolvedAt(LocalDateTime.now());
        holdRepository.save(hold);

        // The event records what left the hold (settledNow), not just what reached
        // recipients — the ledger invariant sums these against releasedAmount, so the two
        // must be the same quantity.
        recordEvent(hold,
                failures.isEmpty() ? HoldEvent.EventType.RELEASED : HoldEvent.EventType.RELEASE_FAILED,
                settledNow, HoldEvent.ActorType.PLATFORM, apiKeyId,
                request != null ? request.getReason() : null, idempotencyKey, null);

        if (!failures.isEmpty()) {
            log.warn("Hold release partially failed: holdId={}, failures={}", hold.getId(), failures);
        }
        log.info("Hold released: holdId={}, toRecipients={}, toPlatform={}, status={}",
                hold.getId(), releasedNow, platformShare, hold.getStatus());
        return hold;
    }

    // ==================== REFUND ====================

    /**
     * Return held money to the payer. Cannot fail while the money is held — unlike an
     * instant-settlement refund, nobody has had a chance to spend it. The Aza fee is
     * returned in full on a refund.
     */
    @Transactional
    public PaymentHold refund(UUID sessionId, UUID merchantId, RefundHoldRequest request,
                              String idempotencyKey, UUID apiKeyId, HoldEvent.ActorType actor) {
        // ADMIN is compliance resolving a hold it froze — the one actor allowed through a
        // freeze, because otherwise a frozen hold has no terminal state at all.
        PaymentHold hold = lockHoldForSettlement(sessionId, merchantId,
                actor == HoldEvent.ActorType.ADMIN);

        HoldEvent replay = findReplay(hold, idempotencyKey);
        if (replay != null) return hold;

        BigDecimal remaining = remainingOf(hold);
        BigDecimal refundAmount = request != null && request.getAmount() != null
                ? request.getAmount().setScale(2, RoundingMode.HALF_UP)
                : remaining;

        if (refundAmount.compareTo(remaining) > 0) {
            throw new AppException("RELEASE_EXCEEDS_HELD",
                    "Refund of GHS " + refundAmount + " exceeds the GHS " + remaining + " still held",
                    HttpStatus.BAD_REQUEST);
        }

        if (!Boolean.TRUE.equals(hold.getTestMode())) {
            Wallet payerWallet = walletRepository.findByUserIdForUpdate(hold.getPayerUserId())
                    .orElseThrow(() -> new AppException("NOT_FOUND",
                            "Payer wallet not found", HttpStatus.NOT_FOUND));
            walletLedger.creditLocked(payerWallet, refundAmount);

            transactionRepository.save(Transaction.builder()
                    .senderId(merchantId)
                    .recipientId(hold.getPayerUserId())
                    .amount(refundAmount)
                    .note("Refund of held payment")
                    .type(Transaction.TransactionType.TRANSFER)
                    .status(Transaction.TransactionStatus.COMPLETED)
                    .idempotencyKey("hold-refund:" + hold.getId() + ":" + hold.getRefundedAmount())
                    .completedAt(LocalDateTime.now())
                    .build());

            notificationService.sendNotification(
                    hold.getPayerUserId(),
                    Notification.NotificationType.MONEY_RECEIVED,
                    "Payment Refunded",
                    "GHS " + refundAmount + " has been returned to your wallet",
                    null);
        }

        hold.setRefundedAmount(hold.getRefundedAmount().add(refundAmount));
        hold.setStatus(statusAfterSettlement(hold));
        if (!hold.isActive()) {
            hold.setResolvedAt(LocalDateTime.now());
            // A compliance refund resolves the freeze along with the hold; leaving the
            // freeze fields set would show a settled hold as still under review.
            hold.setFrozenReason(null);
            hold.setFrozenAt(null);
        }
        holdRepository.save(hold);

        // Recipients who will now never be paid from this hold.
        if (remainingOf(hold).signum() == 0) {
            for (HoldRecipient r : recipientRepository.findAllByHoldId(hold.getId())) {
                if (r.getStatus() == HoldRecipient.Status.PENDING
                        || r.getStatus() == HoldRecipient.Status.RELEASE_FAILED) {
                    r.setStatus(HoldRecipient.Status.REFUNDED);
                    recipientRepository.save(r);
                }
            }
            sessionRepository.findById(hold.getSessionId()).ifPresent(s -> {
                s.setStatus(CheckoutSession.SessionStatus.REFUNDED);
                s.setRefundedAt(LocalDateTime.now());
                sessionRepository.save(s);
            });
        }

        // SYSTEM is only ever the expiry sweep, so it books a distinct event type — an
        // auto-refund because nobody released is a different fact from an integrator
        // deciding to refund, and support will be asked to tell them apart.
        HoldEvent.EventType eventType = actor == HoldEvent.ActorType.SYSTEM
                ? HoldEvent.EventType.EXPIRED_REFUNDED
                : HoldEvent.EventType.REFUNDED;
        recordEvent(hold, eventType, refundAmount, actor, apiKeyId,
                request != null ? request.getReason() : null, idempotencyKey, null);

        log.info("Hold refunded: holdId={}, amount={}, actor={}, status={}",
                hold.getId(), refundAmount, actor, hold.getStatus());
        return hold;
    }

    // ==================== COMPLIANCE FREEZE ====================

    /**
     * Suspend a hold for an Aza compliance reason — fraud, sanctions, a frozen account, a
     * legal order. This is the ONLY circumstance in which Aza acts on a hold of its own
     * initiative outside expiry, and it is deliberately not a dispute mechanism: Aza has no
     * view into whether work was done and does not rule on it (HELD_SETTLEMENT_PLAN §5).
     *
     * A freeze blocks release and refund alike, and stops the expiry clock.
     */
    @Transactional
    public PaymentHold freeze(UUID holdId, String reason, UUID adminId) {
        PaymentHold hold = holdRepository.findById(holdId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Hold not found", HttpStatus.NOT_FOUND));

        if (hold.getStatus() == PaymentHold.HoldStatus.FROZEN) {
            throw new AppException("HOLD_FROZEN", "This hold is already frozen", HttpStatus.CONFLICT);
        }
        if (!hold.isActive()) {
            throw new AppException("HOLD_ALREADY_SETTLED",
                    "This hold is already " + hold.getStatus().name().toLowerCase(), HttpStatus.CONFLICT);
        }

        hold.setStatus(PaymentHold.HoldStatus.FROZEN);
        hold.setFrozenReason(reason);
        hold.setFrozenAt(LocalDateTime.now());
        holdRepository.save(hold);

        recordEvent(hold, HoldEvent.EventType.FROZEN, null, HoldEvent.ActorType.ADMIN,
                null, reason, null, null);

        log.warn("Hold frozen by compliance: holdId={}, adminId={}, reason={}", holdId, adminId, reason);
        return hold;
    }

    /**
     * Lift a compliance freeze. The hold returns to HELD with its window extended by however
     * long it was frozen — an Aza review is Aza's delay, and letting it eat the payer's hold
     * period could auto-refund a payer mid-investigation or leave a recipient no time to be paid.
     */
    @Transactional
    public PaymentHold unfreeze(UUID holdId, UUID adminId) {
        PaymentHold hold = holdRepository.findById(holdId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Hold not found", HttpStatus.NOT_FOUND));

        if (hold.getStatus() != PaymentHold.HoldStatus.FROZEN) {
            throw new AppException("HOLD_NOT_FROZEN", "This hold is not frozen", HttpStatus.CONFLICT);
        }

        if (hold.getFrozenAt() != null) {
            long frozenSeconds = java.time.Duration.between(hold.getFrozenAt(), LocalDateTime.now()).getSeconds();
            if (frozenSeconds > 0) hold.setExpiresAt(hold.getExpiresAt().plusSeconds(frozenSeconds));
        }
        hold.setStatus(PaymentHold.HoldStatus.HELD);
        hold.setFrozenReason(null);
        hold.setFrozenAt(null);
        holdRepository.save(hold);

        recordEvent(hold, HoldEvent.EventType.UNFROZEN, null, HoldEvent.ActorType.ADMIN,
                null, null, null, null);

        log.info("Hold unfrozen: holdId={}, adminId={}, newExpiresAt={}", holdId, adminId, hold.getExpiresAt());
        return hold;
    }

    // ==================== EXPIRY ====================

    /**
     * Return an expired hold's remaining money to the payer.
     *
     * Absence of a release call is absence of evidence that anything was earned, and Aza
     * cannot judge whether it was — so the status quo ante is the only outcome it can
     * defend. Idempotent per hold: the key means a repeated sweep cannot refund twice.
     */
    @Transactional
    public PaymentHold expire(UUID holdId) {
        PaymentHold hold = holdRepository.findById(holdId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Hold not found", HttpStatus.NOT_FOUND));
        return refund(hold.getSessionId(), hold.getMerchantId(), null,
                "expiry:" + hold.getId(), null, HoldEvent.ActorType.SYSTEM);
    }

    /**
     * Compliance returns a frozen hold's money to the payer, resolving it terminally.
     *
     * This is the exit from a freeze. Aza is still not ruling on whether work was done — it
     * is unwinding a payment it should not be holding (fraud, sanctions, a legal order), and
     * the status quo ante is the only outcome it can defend without an opinion it is not
     * entitled to. Releasing to a recipient under those circumstances is never Aza's call.
     */
    @Transactional
    public PaymentHold adminRefund(UUID holdId, String reason, UUID adminId) {
        PaymentHold hold = holdRepository.findById(holdId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Hold not found", HttpStatus.NOT_FOUND));

        RefundHoldRequest request = new RefundHoldRequest();
        request.setReason(reason);
        PaymentHold refunded = refund(hold.getSessionId(), null, request,
                "admin-refund:" + holdId, null, HoldEvent.ActorType.ADMIN);

        log.warn("Hold refunded by compliance: holdId={}, adminId={}, reason={}", holdId, adminId, reason);
        return refunded;
    }

    /**
     * Record that an expiry warning went out, returning false if it already had. The
     * {@code (hold_id, idempotency_key)} constraint is what makes an hourly sweep safe to
     * re-run without spamming an integrator every hour for a week.
     */
    @Transactional
    public boolean markWarned(PaymentHold hold, int daysOut) {
        String key = "expiry-warn-" + daysOut + ":" + hold.getId();
        if (eventRepository.findByHoldIdAndIdempotencyKey(hold.getId(), key).isPresent()) {
            return false;
        }
        recordEvent(hold, HoldEvent.EventType.EXPIRING, remainingOf(hold),
                HoldEvent.ActorType.SYSTEM, null, daysOut + " day(s) until expiry", key, null);
        return true;
    }

    // ==================== READ ====================

    public Optional<PaymentHold> findBySession(UUID sessionId) {
        return holdRepository.findBySessionId(sessionId);
    }

    public HoldInfo toInfo(PaymentHold hold) {
        List<HoldInfo.HoldRecipientInfo> recipients = recipientRepository.findAllByHoldId(hold.getId())
                .stream()
                .map(r -> HoldInfo.HoldRecipientInfo.builder()
                        .recipient(r.getIdentifier())
                        .amount(r.getAmount())
                        .releasedAmount(r.getReleasedAmount())
                        .status(r.getStatus().name())
                        .failureReason(r.getFailureReason())
                        .build())
                .toList();

        return HoldInfo.builder()
                .id(hold.getId().toString())
                .status(hold.getStatus().name())
                .amount(hold.getAmount())
                .releasedAmount(hold.getReleasedAmount())
                .refundedAmount(hold.getRefundedAmount())
                .remainingAmount(remainingOf(hold))
                .azaFee(hold.getAzaFee())
                .heldAt(hold.getHeldAt())
                .expiresAt(hold.getExpiresAt())
                .resolvedAt(hold.getResolvedAt())
                .recipients(recipients)
                .build();
    }

    // ==================== HELPERS ====================

    /** Locks the hold row first, then validates it is this merchant's and still settleable. */
    private PaymentHold lockHoldForSettlement(UUID sessionId, UUID merchantId) {
        return lockHoldForSettlement(sessionId, merchantId, false);
    }

    /**
     * @param allowFrozen compliance resolving a frozen hold. A freeze blocks the integrator
     *                    and the expiry sweep alike, so without this there is no way out of
     *                    a freeze except lifting it — which hands control back to the very
     *                    integrator the freeze may exist because of, and leaves safeguarded
     *                    customer money parked with no defined exit.
     */
    private PaymentHold lockHoldForSettlement(UUID sessionId, UUID merchantId, boolean allowFrozen) {
        PaymentHold hold = holdRepository.findBySessionIdForUpdate(sessionId)
                .orElseThrow(() -> new AppException("NOT_FOUND",
                        "This session has no hold — it settled automatically", HttpStatus.NOT_FOUND));

        if (merchantId != null && !hold.getMerchantId().equals(merchantId)) {
            // Same response as a missing hold: never confirm another merchant's session exists.
            throw new AppException("NOT_FOUND",
                    "This session has no hold — it settled automatically", HttpStatus.NOT_FOUND);
        }
        if (hold.getStatus() == PaymentHold.HoldStatus.FROZEN && !allowFrozen) {
            throw new AppException("HOLD_FROZEN",
                    "This hold is frozen pending an Aza compliance review and cannot be settled",
                    HttpStatus.CONFLICT);
        }
        if (!hold.isActive()) {
            throw new AppException("HOLD_ALREADY_SETTLED",
                    "This hold is already " + hold.getStatus().name().toLowerCase(), HttpStatus.CONFLICT);
        }
        return hold;
    }

    /** A retried Idempotency-Key returns the original outcome without moving money again. */
    private HoldEvent findReplay(PaymentHold hold, String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) return null;
        return eventRepository.findByHoldIdAndIdempotencyKey(hold.getId(), idempotencyKey).orElse(null);
    }

    private Map<UUID, BigDecimal> resolveRequestedPayouts(ReleaseHoldRequest request,
                                                          List<HoldRecipient> recipients) {
        Map<UUID, BigDecimal> payouts = new LinkedHashMap<>();

        if (request == null || request.getRecipients() == null || request.getRecipients().isEmpty()) {
            for (HoldRecipient r : recipients) {
                BigDecimal outstanding = r.getAmount().subtract(r.getReleasedAmount());
                if (outstanding.signum() > 0 && r.getStatus() != HoldRecipient.Status.REFUNDED) {
                    payouts.put(r.getId(), outstanding);
                }
            }
            return payouts;
        }

        for (HoldRecipientRequest req : request.getRecipients()) {
            HoldRecipient match = recipients.stream()
                    .filter(r -> r.getIdentifier().equalsIgnoreCase(req.getRecipient().trim()))
                    .findFirst()
                    .orElseThrow(() -> new AppException("RECIPIENT_NOT_FOUND",
                            "'" + req.getRecipient() + "' is not a recipient on this hold",
                            HttpStatus.BAD_REQUEST));

            BigDecimal amount = req.getAmount().setScale(2, RoundingMode.HALF_UP);
            BigDecimal outstanding = match.getAmount().subtract(match.getReleasedAmount());
            if (amount.compareTo(outstanding) > 0) {
                throw new AppException("RELEASE_EXCEEDS_HELD",
                        "Release of GHS " + amount + " to '" + req.getRecipient()
                                + "' exceeds their outstanding GHS " + outstanding, HttpStatus.BAD_REQUEST);
            }
            payouts.merge(match.getId(), amount, BigDecimal::add);
        }
        return payouts;
    }

    /**
     * A recipient is only RELEASED once their whole amount has been paid. A partial
     * payment leaves them PENDING — otherwise the hold would look fully settled and the
     * platform would draw its margin while the recipient is still owed money.
     */
    private HoldRecipient.Status statusFor(HoldRecipient recipient) {
        return recipient.getReleasedAmount().compareTo(recipient.getAmount()) >= 0
                ? HoldRecipient.Status.RELEASED
                : HoldRecipient.Status.PENDING;
    }

    private BigDecimal remainingOf(PaymentHold hold) {
        return hold.getAmount().subtract(hold.getReleasedAmount()).subtract(hold.getRefundedAmount());
    }

    /** Pro-rata share of the captured fee for {@code portion} of the hold. */
    private BigDecimal feeFor(PaymentHold hold, BigDecimal portion) {
        if (hold.getAmount().signum() == 0) return BigDecimal.ZERO;
        return hold.getAzaFee().multiply(portion)
                .divide(hold.getAmount(), 2, RoundingMode.HALF_UP);
    }

    private PaymentHold.HoldStatus statusAfterSettlement(PaymentHold hold) {
        if (remainingOf(hold).signum() > 0) return PaymentHold.HoldStatus.HELD;
        if (hold.getReleasedAmount().signum() > 0 && hold.getRefundedAmount().signum() > 0) {
            return PaymentHold.HoldStatus.PARTIALLY_SETTLED;
        }
        return hold.getRefundedAmount().signum() > 0
                ? PaymentHold.HoldStatus.REFUNDED
                : PaymentHold.HoldStatus.RELEASED;
    }

    private void recordEvent(PaymentHold hold, HoldEvent.EventType type, BigDecimal amount,
                             HoldEvent.ActorType actor, UUID apiKeyId, String reason,
                             String idempotencyKey, UUID transactionId) {
        eventRepository.save(HoldEvent.builder()
                .holdId(hold.getId())
                .eventType(type)
                .amount(amount)
                .actorType(actor)
                .apiKeyId(apiKeyId)
                .reason(reason)
                .idempotencyKey(idempotencyKey)
                .transactionId(transactionId)
                .build());
    }
}
