package com.aza.backend.service;

import com.aza.backend.dto.akyede.CreateEnvelopeRequest;
import com.aza.backend.dto.akyede.EnvelopeResponse;
import com.aza.backend.entity.*;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.*;
import com.aza.backend.dto.websocket.WebSocketEventType;
import com.aza.backend.util.RateLimitService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Optional;
import java.util.UUID;

/**
 * Akyede — giving one person money as a gift.
 *
 * The sender pays once, up front, and the money sits in the gift until the recipient
 * opens it or it expires. Two consequences drive most of the code here:
 *
 * <ul>
 *   <li>An unopened gift is customer money sitting outside every wallet, so it is
 *       counted in the safeguarding snapshot and against the sender's daily limit.</li>
 *   <li>The gift is addressed. Only {@code recipientId} may open it, and the claim code
 *       is how that person reaches it — not a bearer token that pays whoever holds it.
 *       This is a gift, not a draw: the amount is fixed by the sender and nobody
 *       competes for it.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RedEnvelopeService {

    private final RedEnvelopeRepository envelopeRepository;
    private final WalletRepository walletRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final WalletLedger walletLedger;
    private final ChatRepository chatRepository;
    private final BlockedUserRepository blockedUserRepository;
    private final NotificationService notificationService;
    private final WebSocketPublisher webSocketPublisher;
    private final AfterCommitExecutor afterCommit;
    private final RateLimitService rateLimitService;
    private final RecipientResolver recipientResolver;
    private final UserService userService;
    private final LimitGuard limitGuard;

    @Value("${aza.app.base-url:https://aza.systems}")
    private String appBaseUrl;

    private static final ZoneId GHANA_TZ = ZoneId.of("Africa/Accra");
    private static final int DEFAULT_EXPIRY_HOURS = 168; // a week to notice a gift
    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 10;

    // ==================== SEND ====================

    @Transactional
    public EnvelopeResponse create(User sender, CreateEnvelopeRequest req) {
        // Replaying the key returns the original gift rather than sending twice — a retry
        // on a flaky connection must not cost the sender a second gift.
        Optional<RedEnvelope> replay = envelopeRepository.findByClaimCode(idempotentCode(sender, req));
        if (replay.isPresent()) {
            return toResponse(replay.get(), sender.getId());
        }

        if (sender.getStatus() != User.AccountStatus.ACTIVE) {
            throw new AppException("Your account is not active");
        }
        if (sender.getKycStatus() != User.KycStatus.VERIFIED) {
            throw new AppException("KYC verification required before sending Akyede");
        }
        rateLimitService.enforceRateLimit("akyede:create:" + sender.getId(), 20, java.time.Duration.ofHours(1));

        // This is a debit like any other, so it is authorised like any other. A live
        // session is not on its own permission to take money out of the wallet.
        userService.verifyPasscode(sender, req.getPasscode());

        User recipient = resolveRecipient(sender, req.getRecipient());
        BigDecimal amount = req.getAmount().setScale(2, RoundingMode.HALF_UP);

        limitGuard.enforceSingle(sender, amount);
        enforceDailyLimit(sender, amount);

        Wallet wallet = walletRepository.findByUserIdForUpdate(sender.getId())
                .orElseThrow(() -> new AppException("Wallet not found"));
        if (Boolean.TRUE.equals(wallet.getFrozen())) {
            throw new AppException("WALLET_FROZEN",
                    "Your wallet has been frozen. Please contact support.", HttpStatus.FORBIDDEN);
        }
        if (wallet.getBalance().compareTo(amount) < 0) {
            throw new AppException("INSUFFICIENT_FUNDS", "Insufficient balance", HttpStatus.BAD_REQUEST);
        }

        if (req.getChatId() != null) {
            assertSenderIsInChat(sender, req.getChatId());
        }

        // The sender pays now. From here the money belongs to the gift: it has left this
        // wallet and reaches nobody until it is opened or returned.
        walletLedger.debitLocked(wallet, amount);

        int expiryHours = req.getExpiresInHours() != null ? req.getExpiresInHours() : DEFAULT_EXPIRY_HOURS;

        RedEnvelope gift = envelopeRepository.save(RedEnvelope.builder()
                .claimCode(idempotentCode(sender, req))
                .senderId(sender.getId())
                .recipientId(recipient.getId())
                .chatId(req.getChatId())
                .amount(amount)
                .occasion(parseOccasion(req.getOccasion()))
                .message(blankToNull(req.getMessage()))
                .status(RedEnvelope.Status.UNOPENED)
                .expiresAt(LocalDateTime.now().plusHours(expiryHours))
                .build());

        // One ledger row for the whole life of the gift, dated when the money actually
        // left the wallet. It is written PENDING and expires with the gift, so it counts
        // against the sender's cap today — and completing it on open does not charge them
        // a second time on whatever day the recipient gets round to opening it.
        Transaction escrow = transactionRepository.save(Transaction.builder()
                .senderId(sender.getId())
                .recipientId(recipient.getId())
                .recipientType(Transaction.RecipientType.USER)
                .amount(amount)
                .note(gift.getMessage() != null ? gift.getMessage() : "Akyede")
                .type(Transaction.TransactionType.TRANSFER)
                .status(Transaction.TransactionStatus.PENDING)
                .expiresAt(gift.getExpiresAt())
                .idempotencyKey("akyede:" + gift.getId())
                .build());
        gift.setTransactionId(escrow.getId());
        envelopeRepository.save(gift);

        // An addressed gift is worth nothing if the person never learns it is waiting.
        notificationService.sendNotification(
                recipient.getId(),
                Notification.NotificationType.MONEY_RECEIVED,
                "You have an Akyede",
                displayName(sender) + " sent you a gift. Tap to open it.",
                null, null);

        log.info("Akyede sent: id={}, sender={}, recipient={}, amount={}, occasion={}, expiresAt={}",
                gift.getId(), sender.getId(), recipient.getId(), amount, gift.getOccasion(), gift.getExpiresAt());

        return toResponse(gift, sender.getId());
    }

    /**
     * Resolve who the gift is for, and refuse the ones that cannot hold it.
     *
     * The same resolver a transfer uses, so a handle means the same person here as it
     * does in the send flow. Blocks are honoured in both directions: money is a way to
     * reach someone, and a blocked sender does not get to use it as one.
     */
    private User resolveRecipient(User sender, String identifier) {
        RecipientResolver.Resolution resolution = recipientResolver.resolve(identifier);
        if (!resolution.payable()) {
            RecipientResolver.Unpayable problem = resolution.problem();
            throw new AppException(
                    problem == RecipientResolver.Unpayable.NOT_FOUND ? "RECIPIENT_NOT_FOUND" : "RECIPIENT_UNPAYABLE",
                    problem.reason, HttpStatus.BAD_REQUEST);
        }
        User recipient = resolution.user();

        if (recipient.getId().equals(sender.getId())) {
            throw new AppException("OWN_GIFT", "You can't send an Akyede to yourself.", HttpStatus.BAD_REQUEST);
        }
        if (blockedUserRepository.existsByBlockerIdAndBlockedUserId(recipient.getId(), sender.getId())
                || blockedUserRepository.existsByBlockerIdAndBlockedUserId(sender.getId(), recipient.getId())) {
            throw new AppException("RECIPIENT_UNAVAILABLE",
                    "You can't send an Akyede to this person.", HttpStatus.FORBIDDEN);
        }
        return recipient;
    }

    /**
     * A sender's own unopened gifts count against their daily limit even though the money
     * has not reached anyone. Otherwise the cap is trivially avoided: lock the day's
     * ceiling into gifts, then open them from a second account.
     *
     * They are counted through the pending ledger row each gift writes, which
     * {@code getTotalSentToday} already includes while it is unexpired — so the gift is
     * counted once, on the day the money left, whenever it is finally opened.
     */
    private void enforceDailyLimit(User sender, BigDecimal amount) {
        LocalDateTime startOfDay = LocalDate.now(GHANA_TZ).atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1);

        BigDecimal sentToday = transactionRepository.getTotalSentToday(
                sender.getId(), startOfDay, endOfDay, LocalDateTime.now(GHANA_TZ));

        BigDecimal dailyLimit = limitGuard.dailyLimit(sender);
        if (sentToday.add(amount).compareTo(dailyLimit) > 0) {
            BigDecimal remaining = dailyLimit.subtract(sentToday).max(BigDecimal.ZERO);
            throw new AppException("LIMIT_EXCEEDED",
                    "This would exceed your daily limit. Remaining today: GHS " + remaining.toPlainString(),
                    HttpStatus.BAD_REQUEST);
        }
    }

    /**
     * Check the sender is in the thread they are sending the gift into.
     *
     * The message itself is not written here. Chats are end-to-end encrypted and the
     * money cards in them are JSON the client seals inside an ordinary message — the
     * server has no key, so anything it wrote into the thread would reach the reader as
     * undecryptable noise. The client sends the gift card after this returns.
     */
    private void assertSenderIsInChat(User sender, UUID chatId) {
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new AppException("Chat not found"));
        if (!chat.getParticipantOneId().equals(sender.getId())
                && !chat.getParticipantTwoId().equals(sender.getId())) {
            throw new AppException("FORBIDDEN", "You are not in this chat", HttpStatus.FORBIDDEN);
        }
    }

    // ==================== PREVIEW ====================

    /**
     * Look at a gift without opening it — what the recipient sees while it is still
     * wrapped, and what the sender sees when checking on one they sent.
     */
    @Transactional(readOnly = true)
    public EnvelopeResponse preview(String claimCode, UUID viewerId) {
        RedEnvelope gift = envelopeRepository.findByClaimCode(normalizeCode(claimCode))
                .orElseThrow(() -> new AppException("NOT_FOUND", "This Akyede is not valid.", HttpStatus.NOT_FOUND));
        return toResponse(gift, viewerId);
    }

    // ==================== OPEN ====================

    @Transactional
    public EnvelopeResponse open(User recipient, String claimCode) {
        if (recipient.getStatus() != User.AccountStatus.ACTIVE) {
            throw new AppException("Your account is not active");
        }

        // Serialised from here: the read of the status and the write that credits the
        // wallet must not interleave with a double-tap or a retry of the same open.
        RedEnvelope gift = envelopeRepository.findByClaimCodeForUpdate(normalizeCode(claimCode))
                .orElseThrow(() -> new AppException("NOT_FOUND", "This Akyede is not valid.", HttpStatus.NOT_FOUND));

        if (gift.getSenderId().equals(recipient.getId())) {
            throw new AppException("OWN_GIFT", "You can't open an Akyede you sent.", HttpStatus.BAD_REQUEST);
        }
        // The gift is addressed. Holding the code is not the same as being given it.
        if (!gift.getRecipientId().equals(recipient.getId())) {
            throw new AppException("NOT_YOURS", "This Akyede was sent to someone else.", HttpStatus.FORBIDDEN);
        }
        if (gift.getStatus() == RedEnvelope.Status.OPENED) {
            throw new AppException("ALREADY_OPENED", "You've already opened this Akyede.", HttpStatus.CONFLICT);
        }
        if (gift.getStatus() != RedEnvelope.Status.UNOPENED) {
            throw new AppException("GIFT_CLOSED", "This Akyede is no longer available.", HttpStatus.CONFLICT);
        }
        if (LocalDateTime.now().isAfter(gift.getExpiresAt())) {
            // The sweep will return it; refuse the open rather than pay out late.
            throw new AppException("GIFT_EXPIRED", "This Akyede has expired.", HttpStatus.CONFLICT);
        }

        BigDecimal amount = gift.getAmount();

        Wallet wallet = walletRepository.findByUserIdForUpdate(recipient.getId())
                .orElseThrow(() -> new AppException("Wallet not found"));
        if (Boolean.TRUE.equals(wallet.getFrozen())) {
            throw new AppException("WALLET_FROZEN",
                    "Your wallet has been frozen. Please contact support.", HttpStatus.FORBIDDEN);
        }
        limitGuard.enforceWalletCeiling(recipient, wallet.getBalance().add(amount));

        // The row written when the money left is completed here rather than a second one
        // being added: one gift is one movement, dated when the sender paid for it.
        Transaction escrow = transactionRepository.findById(gift.getTransactionId())
                .orElseThrow(() -> new AppException("NO_LEDGER_ENTRY",
                        "This Akyede has no ledger entry and cannot be settled.", HttpStatus.CONFLICT));
        escrow.setStatus(Transaction.TransactionStatus.COMPLETED);
        escrow.setCompletedAt(LocalDateTime.now());
        transactionRepository.save(escrow);

        walletLedger.creditLocked(wallet, amount);

        gift.setStatus(RedEnvelope.Status.OPENED);
        gift.setOpenedAt(LocalDateTime.now());
        gift.setSettledAt(LocalDateTime.now());
        envelopeRepository.save(gift);

        log.info("Akyede opened: id={}, recipient={}, amount={}", gift.getId(), recipient.getId(), amount);

        EnvelopeResponse response = toResponse(gift, recipient.getId());
        Chat chat = gift.getChatId() != null ? chatRepository.findById(gift.getChatId()).orElse(null) : null;

        // Deferred past commit. A push saying the gift was opened has already left by the
        // time a rollback undoes the credit, which would tell the sender their money moved
        // when it did not. Read the chat above, while the entities are still managed.
        UUID senderId = gift.getSenderId();
        String openerName = displayName(recipient);
        afterCommit.run(() -> {
            notificationService.sendNotification(
                    senderId,
                    Notification.NotificationType.MONEY_RECEIVED,
                    "Akyede opened",
                    openerName + " opened your GHS " + amount.toPlainString() + " Akyede.",
                    null, amount);
            if (chat != null) {
                webSocketPublisher.publishToChatRoom(
                        chat.getParticipantOneId(), chat.getParticipantTwoId(),
                        WebSocketEventType.TRANSFER_UPDATE, response);
            }
        });
        return response;
    }

    // ==================== EXPIRY ====================

    /**
     * Return a gift nobody opened. Called per gift by the sweep so one that cannot be
     * settled fails alone. Safe to call twice — a gift already settled is a no-op.
     */
    @Transactional
    public void expire(UUID giftId) {
        RedEnvelope gift = envelopeRepository.findByIdForUpdate(giftId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Akyede not found", HttpStatus.NOT_FOUND));
        if (gift.getStatus() != RedEnvelope.Status.UNOPENED) return;

        BigDecimal outstanding = gift.outstandingAmount();

        if (outstanding.signum() <= 0) {
            gift.setStatus(RedEnvelope.Status.EXPIRED_REFUNDED);
            gift.setSettledAt(LocalDateTime.now());
            envelopeRepository.save(gift);
            return;
        }

        // Found before anything is marked settled: a gift is only closed once the money
        // has somewhere to go back to.
        Wallet senderWallet = walletRepository.findByUserIdForUpdate(gift.getSenderId()).orElse(null);
        if (senderWallet == null) {
            // Nothing to refund into. Leave it UNOPENED so the sweep retries rather than
            // marking the money settled when it went nowhere.
            log.error("Akyede refund failed — sender wallet missing: gift={}, sender={}, outstanding={}",
                    gift.getId(), gift.getSenderId(), outstanding);
            throw new AppException("NO_WALLET", "Sender wallet not found", HttpStatus.NOT_FOUND);
        }

        gift.setStatus(RedEnvelope.Status.EXPIRED_REFUNDED);
        gift.setSettledAt(LocalDateTime.now());
        walletLedger.creditLocked(senderWallet, outstanding);

        gift.setRefundedAmount(
                (gift.getRefundedAmount() == null ? BigDecimal.ZERO : gift.getRefundedAmount()).add(outstanding));
        envelopeRepository.save(gift);

        // The movement never happened, so the row that recorded it is cancelled rather
        // than a second, opposite one being invented. A sender's statement should show
        // one gift that came back, not a payment to themselves.
        if (gift.getTransactionId() != null) {
            transactionRepository.findById(gift.getTransactionId()).ifPresent(escrow -> {
                escrow.setStatus(Transaction.TransactionStatus.CANCELLED);
                escrow.setCancelledAt(LocalDateTime.now());
                transactionRepository.save(escrow);
            });
        }

        notificationService.sendNotification(
                gift.getSenderId(),
                Notification.NotificationType.MONEY_RECEIVED,
                "Akyede returned",
                "GHS " + outstanding.toPlainString() + " you sent as an Akyede went unopened and is back in your wallet.",
                null, outstanding);

        log.info("Akyede expired and refunded: gift={}, sender={}, refunded={}",
                gift.getId(), gift.getSenderId(), outstanding);
    }

    public java.util.List<RedEnvelope> findExpired() {
        return envelopeRepository.findExpired(LocalDateTime.now());
    }

    // ==================== QUERIES ====================

    @Transactional(readOnly = true)
    public Page<EnvelopeResponse> listSent(UUID senderId, int page, int size) {
        return envelopeRepository
                .findAllBySenderIdOrderByCreatedAtDesc(senderId, PageRequest.of(page, Math.min(size, 50)))
                .map(e -> toResponse(e, senderId));
    }

    @Transactional(readOnly = true)
    public Page<EnvelopeResponse> listReceived(UUID recipientId, int page, int size) {
        return envelopeRepository
                .findAllByRecipientIdOrderByCreatedAtDesc(recipientId, PageRequest.of(page, Math.min(size, 50)))
                .map(e -> toResponse(e, recipientId));
    }

    // ==================== MAPPING ====================

    EnvelopeResponse toResponse(RedEnvelope gift, UUID viewerId) {
        User sender = userRepository.findById(gift.getSenderId()).orElse(null);
        User recipient = userRepository.findById(gift.getRecipientId()).orElse(null);

        boolean isSender = viewerId != null && viewerId.equals(gift.getSenderId());
        boolean isRecipient = viewerId != null && viewerId.equals(gift.getRecipientId());
        boolean opened = gift.getStatus() == RedEnvelope.Status.OPENED;
        boolean expired = gift.getStatus() == RedEnvelope.Status.EXPIRED_REFUNDED
                || LocalDateTime.now().isAfter(gift.getExpiresAt());

        String blockedReason = null;
        if (isSender) blockedReason = "OWN_GIFT";
        else if (!isRecipient) blockedReason = "NOT_YOURS";
        else if (opened) blockedReason = "ALREADY_OPENED";
        else if (expired) blockedReason = "EXPIRED";

        // The sender always sees what they gave. The recipient sees it once they have
        // opened it — the surprise is the whole ceremony, and a wrapper that announces
        // the amount is not a wrapper. Nobody else sees it at all.
        boolean revealAmount = isSender || (isRecipient && opened);

        return EnvelopeResponse.builder()
                .id(gift.getId().toString())
                .claimCode(gift.getClaimCode())
                .claimUrl(appBaseUrl + "/akyede/" + gift.getClaimCode())
                .senderName(sender != null ? displayName(sender) : "Someone")
                .senderHandle(sender != null ? sender.getUsername() : null)
                .senderAvatarUrl(sender != null ? sender.getProfileImageUrl() : null)
                .recipientName(recipient != null ? displayName(recipient) : null)
                .recipientHandle(recipient != null ? recipient.getUsername() : null)
                .recipientAvatarUrl(recipient != null ? recipient.getProfileImageUrl() : null)
                .message(gift.getMessage())
                .occasion(gift.getOccasion() != null ? gift.getOccasion().name() : null)
                .currency(gift.getCurrency())
                .status(gift.getStatus().name())
                .expiresAt(gift.getExpiresAt())
                .createdAt(gift.getCreatedAt())
                .openedAt(gift.getOpenedAt())
                .amount(revealAmount ? gift.getAmount() : null)
                .openable(blockedReason == null)
                .blockedReason(blockedReason)
                .sentByMe(isSender)
                .build();
    }

    // ==================== HELPERS ====================

    private static String displayName(User u) {
        String first = u.getFirstName() != null ? u.getFirstName() : "";
        String last = u.getLastName() != null ? u.getLastName() : "";
        String name = (first + " " + last).trim();
        return name.isEmpty() ? "Someone" : name;
    }

    private static RedEnvelope.Occasion parseOccasion(String raw) {
        if (raw == null || raw.isBlank()) return RedEnvelope.Occasion.JUST_BECAUSE;
        try {
            return RedEnvelope.Occasion.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException("INVALID_OCCASION", "That is not an occasion we know.", HttpStatus.BAD_REQUEST);
        }
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    static String normalizeCode(String code) {
        return code == null ? "" : code.trim().toUpperCase();
    }

    /**
     * The claim code doubles as the idempotency record: it is derived from the sender
     * and their key, so replaying a send finds the gift it already made instead of
     * charging them a second time.
     */
    private static String idempotentCode(User sender, CreateEnvelopeRequest req) {
        byte[] seed = (sender.getId() + ":" + req.getIdempotencyKey())
                .getBytes(java.nio.charset.StandardCharsets.UTF_8);
        try {
            byte[] digest = java.security.MessageDigest.getInstance("SHA-256").digest(seed);
            StringBuilder sb = new StringBuilder(CODE_LENGTH);
            for (int i = 0; i < CODE_LENGTH; i++) {
                sb.append(CODE_ALPHABET.charAt((digest[i] & 0xFF) % CODE_ALPHABET.length()));
            }
            return sb.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
