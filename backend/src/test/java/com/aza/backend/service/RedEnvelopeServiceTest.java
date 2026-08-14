package com.aza.backend.service;

import com.aza.backend.dto.akyede.CreateEnvelopeRequest;
import com.aza.backend.dto.akyede.EnvelopeResponse;
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
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Akyede is a gift to one named person, not a draw several people race for. These tests
 * are mostly about that distinction: the amount is the sender's choice, only the person
 * it was addressed to may take it, and money that reaches nobody goes home.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class RedEnvelopeServiceTest {

    @Autowired RedEnvelopeService service;

    @MockitoBean RedEnvelopeRepository envelopeRepository;
    @MockitoBean WalletRepository walletRepository;
    @MockitoBean UserRepository userRepository;
    @MockitoBean TransactionRepository transactionRepository;
    @MockitoBean ChatRepository chatRepository;
    @MockitoBean ChatMessageRepository chatMessageRepository;
    @MockitoBean BlockedUserRepository blockedUserRepository;
    @MockitoBean NotificationService notificationService;
    @MockitoBean WebSocketPublisher webSocketPublisher;
    @MockitoBean RecipientResolver recipientResolver;
    @MockitoBean UserService userService;
    @MockitoBean StringRedisTemplate stringRedisTemplate;
    @MockitoBean RedisMessageListenerContainer redisMessageListenerContainer;

    private final UUID senderId = UUID.randomUUID();
    private final UUID recipientId = UUID.randomUUID();

    /** Stands in for the transactions table so a gift's ledger row can be settled. */
    private final java.util.Map<UUID, Transaction> ledger = new java.util.HashMap<>();

    @BeforeEach
    void setUp() {
        ledger.clear();
        when(envelopeRepository.save(any(RedEnvelope.class))).thenAnswer(inv -> {
            RedEnvelope e = inv.getArgument(0);
            if (e.getId() == null) e.setId(UUID.randomUUID());
            return e;
        });
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(inv -> {
            Transaction t = inv.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            ledger.put(t.getId(), t);
            return t;
        });
        when(transactionRepository.findById(any()))
                .thenAnswer(inv -> Optional.ofNullable(ledger.get(inv.getArgument(0))));
        when(transactionRepository.getTotalSentToday(any(), any(), any(), any())).thenReturn(BigDecimal.ZERO);
        when(envelopeRepository.findByClaimCode(anyString())).thenReturn(Optional.empty());
        when(blockedUserRepository.existsByBlockerIdAndBlockedUserId(any(), any())).thenReturn(false);

        // Resolves to a payable recipient unless a test says otherwise.
        when(recipientResolver.resolve(anyString()))
                .thenReturn(new RecipientResolver.Resolution(activeUser(recipientId), null));
    }

    // ── Sending ───────────────────────────────────────────────────────────────

    @Test
    void send_debitsSenderInFull() {
        User sender = verifiedSender();
        Wallet senderWallet = wallet(senderId, "500.00");
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.of(senderWallet));
        when(userRepository.findById(senderId)).thenReturn(Optional.of(sender));
        when(userRepository.findById(recipientId)).thenReturn(Optional.of(activeUser(recipientId)));

        service.create(sender, request("100.00"));

        assertEquals(new BigDecimal("400.00"), senderWallet.getBalance());
    }

    @Test
    void send_holdsTheMoneyRatherThanCreditingTheRecipient() {
        User sender = verifiedSender();
        Wallet senderWallet = wallet(senderId, "500.00");
        Wallet recipientWallet = wallet(recipientId, "0.00");
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.of(senderWallet));
        when(userRepository.findById(senderId)).thenReturn(Optional.of(sender));
        when(userRepository.findById(recipientId)).thenReturn(Optional.of(activeUser(recipientId)));

        service.create(sender, request("100.00"));

        // The gift is not a transfer. Nothing reaches the recipient until they open it,
        // but the money did leave the sender, so the ledger says so — as PENDING.
        assertEquals(new BigDecimal("0.00"), recipientWallet.getBalance());
        assertEquals(1, ledger.size());
        Transaction escrow = ledger.values().iterator().next();
        assertEquals(Transaction.TransactionStatus.PENDING, escrow.getStatus());
        assertEquals(senderId, escrow.getSenderId());
        assertEquals(recipientId, escrow.getRecipientId());
    }

    /**
     * The gift is counted against the sender's cap on the day the money left, through
     * the pending row — not again on whatever day the recipient opens it.
     */
    @Test
    void open_completesTheRowWrittenAtSend_ratherThanAddingASecondOne() {
        RedEnvelope gift = unopenedGift("100.00");
        Transaction escrow = escrowFor(gift);
        User recipient = activeUser(recipientId);
        stubOpen(gift, recipient, wallet(recipientId, "0.00"));

        service.open(recipient, gift.getClaimCode());

        assertEquals(1, ledger.size());
        assertEquals(Transaction.TransactionStatus.COMPLETED, escrow.getStatus());
    }

    @Test
    void expire_cancelsTheRowRatherThanInventingAPaymentToYourself() {
        RedEnvelope gift = unopenedGift("100.00");
        Transaction escrow = escrowFor(gift);
        when(envelopeRepository.findByIdForUpdate(gift.getId())).thenReturn(Optional.of(gift));
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.of(wallet(senderId, "10.00")));
        when(userRepository.findById(senderId)).thenReturn(Optional.of(verifiedSender()));

        service.expire(gift.getId());

        assertEquals(1, ledger.size());
        assertEquals(Transaction.TransactionStatus.CANCELLED, escrow.getStatus());
    }

    @Test
    void send_withoutTheRightPasscode_movesNoMoney() {
        User sender = verifiedSender();
        Wallet senderWallet = wallet(senderId, "500.00");
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.of(senderWallet));
        doThrow(new AppException("Invalid passcode"))
                .when(userService).verifyPasscode(any(), anyString());

        assertThrows(AppException.class, () -> service.create(sender, request("100.00")));
        // A live session is not on its own permission to empty a wallet.
        assertEquals(new BigDecimal("500.00"), senderWallet.getBalance());
        assertTrue(ledger.isEmpty());
    }

    @Test
    void send_tellsTheRecipientSomethingIsWaiting() {
        User sender = verifiedSender();
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.of(wallet(senderId, "500.00")));
        when(userRepository.findById(senderId)).thenReturn(Optional.of(sender));
        when(userRepository.findById(recipientId)).thenReturn(Optional.of(activeUser(recipientId)));

        service.create(sender, request("100.00"));

        verify(notificationService).sendNotification(
                eq(recipientId), eq(Notification.NotificationType.MONEY_RECEIVED),
                anyString(), anyString(), any(), any());
    }

    @Test
    void send_toYourself_isRejected() {
        User sender = verifiedSender();
        when(recipientResolver.resolve(anyString()))
                .thenReturn(new RecipientResolver.Resolution(sender, null));
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.of(wallet(senderId, "500.00")));

        AppException e = assertThrows(AppException.class, () -> service.create(sender, request("100.00")));
        assertEquals("OWN_GIFT", e.getCode());
    }

    @Test
    void send_toSomeoneWhoBlockedYou_isRejected() {
        User sender = verifiedSender();
        when(blockedUserRepository.existsByBlockerIdAndBlockedUserId(recipientId, senderId)).thenReturn(true);
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.of(wallet(senderId, "500.00")));

        AppException e = assertThrows(AppException.class, () -> service.create(sender, request("100.00")));
        assertEquals("RECIPIENT_UNAVAILABLE", e.getCode());
    }

    @Test
    void send_toAnUnpayableRecipient_isRejectedBeforeTheSenderIsCharged() {
        User sender = verifiedSender();
        Wallet senderWallet = wallet(senderId, "500.00");
        when(recipientResolver.resolve(anyString())).thenReturn(
                new RecipientResolver.Resolution(null, RecipientResolver.Unpayable.NOT_FOUND));
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.of(senderWallet));

        AppException e = assertThrows(AppException.class, () -> service.create(sender, request("100.00")));
        assertEquals("RECIPIENT_NOT_FOUND", e.getCode());
        assertEquals(new BigDecimal("500.00"), senderWallet.getBalance());
    }

    @Test
    void send_insufficientBalance_isRejected() {
        User sender = verifiedSender();
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.of(wallet(senderId, "50.00")));

        AppException e = assertThrows(AppException.class, () -> service.create(sender, request("100.00")));
        assertEquals("INSUFFICIENT_FUNDS", e.getCode());
    }

    @Test
    void send_unopenedGiftsCountTowardTheDailyLimit() {
        User sender = verifiedSender();
        sender.setCustomDailyLimitGhs(new BigDecimal("500"));
        // 450 already gone today — gifts included, via their pending rows.
        when(transactionRepository.getTotalSentToday(any(), any(), any(), any()))
                .thenReturn(new BigDecimal("450.00"));
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.of(wallet(senderId, "5000.00")));

        AppException e = assertThrows(AppException.class, () -> service.create(sender, request("100.00")));
        assertEquals("LIMIT_EXCEEDED", e.getCode());
    }

    @Test
    void send_replayingTheIdempotencyKey_returnsTheSameGiftAndChargesOnce() {
        User sender = verifiedSender();
        Wallet senderWallet = wallet(senderId, "500.00");
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.of(senderWallet));
        when(userRepository.findById(senderId)).thenReturn(Optional.of(sender));
        when(userRepository.findById(recipientId)).thenReturn(Optional.of(activeUser(recipientId)));

        CreateEnvelopeRequest req = request("100.00");
        EnvelopeResponse first = service.create(sender, req);

        // The replay finds the gift the first call already made.
        RedEnvelope existing = unopenedGift("100.00");
        existing.setClaimCode(first.getClaimCode());
        when(envelopeRepository.findByClaimCode(first.getClaimCode())).thenReturn(Optional.of(existing));

        EnvelopeResponse second = service.create(sender, req);

        assertEquals(first.getClaimCode(), second.getClaimCode());
        assertEquals(new BigDecimal("400.00"), senderWallet.getBalance());
    }

    // ── Opening ───────────────────────────────────────────────────────────────

    @Test
    void open_creditsTheRecipientTheWholeAmount() {
        RedEnvelope gift = unopenedGift("100.00");
        User recipient = activeUser(recipientId);
        Wallet recipientWallet = wallet(recipientId, "20.00");
        stubOpen(gift, recipient, recipientWallet);

        EnvelopeResponse response = service.open(recipient, gift.getClaimCode());

        assertEquals(new BigDecimal("120.00"), recipientWallet.getBalance());
        assertEquals(new BigDecimal("100.00"), response.getAmount());
        assertEquals(RedEnvelope.Status.OPENED, gift.getStatus());
        assertNotNull(gift.getOpenedAt());
    }

    @Test
    void open_bySomeoneElseHoldingTheCode_isRejected() {
        RedEnvelope gift = unopenedGift("100.00");
        UUID strangerId = UUID.randomUUID();
        User stranger = activeUser(strangerId);
        Wallet strangerWallet = wallet(strangerId, "0.00");
        stubOpen(gift, stranger, strangerWallet);

        AppException e = assertThrows(AppException.class, () -> service.open(stranger, gift.getClaimCode()));
        assertEquals("NOT_YOURS", e.getCode());
        assertEquals(new BigDecimal("0.00"), strangerWallet.getBalance());
        assertEquals(RedEnvelope.Status.UNOPENED, gift.getStatus());
    }

    @Test
    void open_yourOwnGift_isRejected() {
        RedEnvelope gift = unopenedGift("100.00");
        User sender = verifiedSender();
        stubOpen(gift, sender, wallet(senderId, "0.00"));

        AppException e = assertThrows(AppException.class, () -> service.open(sender, gift.getClaimCode()));
        assertEquals("OWN_GIFT", e.getCode());
    }

    @Test
    void open_twice_isRejected() {
        RedEnvelope gift = unopenedGift("100.00");
        User recipient = activeUser(recipientId);
        Wallet recipientWallet = wallet(recipientId, "0.00");
        stubOpen(gift, recipient, recipientWallet);

        service.open(recipient, gift.getClaimCode());
        AppException e = assertThrows(AppException.class, () -> service.open(recipient, gift.getClaimCode()));

        assertEquals("ALREADY_OPENED", e.getCode());
        // Paid once, not twice.
        assertEquals(new BigDecimal("100.00"), recipientWallet.getBalance());
    }

    @Test
    void open_afterExpiry_isRejectedRatherThanPaidLate() {
        RedEnvelope gift = unopenedGift("100.00");
        gift.setExpiresAt(LocalDateTime.now().minusMinutes(1));
        User recipient = activeUser(recipientId);
        Wallet recipientWallet = wallet(recipientId, "0.00");
        stubOpen(gift, recipient, recipientWallet);

        AppException e = assertThrows(AppException.class, () -> service.open(recipient, gift.getClaimCode()));
        assertEquals("GIFT_EXPIRED", e.getCode());
        assertEquals(new BigDecimal("0.00"), recipientWallet.getBalance());
    }

    @Test
    void open_tellsTheSenderTheirGiftLanded() {
        RedEnvelope gift = unopenedGift("100.00");
        User recipient = activeUser(recipientId);
        stubOpen(gift, recipient, wallet(recipientId, "0.00"));

        service.open(recipient, gift.getClaimCode());

        verify(notificationService).sendNotification(
                eq(senderId), eq(Notification.NotificationType.MONEY_RECEIVED),
                eq("Akyede opened"), anyString(), any(), eq(new BigDecimal("100.00")));
    }

    // ── The wrapping ──────────────────────────────────────────────────────────

    @Test
    void preview_hidesTheAmountFromTheRecipientUntilTheyOpenIt() {
        RedEnvelope gift = unopenedGift("100.00");
        when(envelopeRepository.findByClaimCode(gift.getClaimCode())).thenReturn(Optional.of(gift));
        when(userRepository.findById(senderId)).thenReturn(Optional.of(verifiedSender()));
        when(userRepository.findById(recipientId)).thenReturn(Optional.of(activeUser(recipientId)));

        // Still wrapped: the surprise is the point.
        assertNull(service.preview(gift.getClaimCode(), recipientId).getAmount());
        // The sender chose the amount, so it was never hidden from them.
        assertEquals(new BigDecimal("100.00"), service.preview(gift.getClaimCode(), senderId).getAmount());
    }

    @Test
    void preview_showsTheRecipientTheAmountOnceOpened() {
        RedEnvelope gift = unopenedGift("100.00");
        gift.setStatus(RedEnvelope.Status.OPENED);
        gift.setOpenedAt(LocalDateTime.now());
        when(envelopeRepository.findByClaimCode(gift.getClaimCode())).thenReturn(Optional.of(gift));
        when(userRepository.findById(senderId)).thenReturn(Optional.of(verifiedSender()));
        when(userRepository.findById(recipientId)).thenReturn(Optional.of(activeUser(recipientId)));

        EnvelopeResponse response = service.preview(gift.getClaimCode(), recipientId);
        assertEquals(new BigDecimal("100.00"), response.getAmount());
        assertEquals("ALREADY_OPENED", response.getBlockedReason());
    }

    @Test
    void preview_showsAStrangerNothingButTheWrapping() {
        RedEnvelope gift = unopenedGift("100.00");
        when(envelopeRepository.findByClaimCode(gift.getClaimCode())).thenReturn(Optional.of(gift));
        when(userRepository.findById(senderId)).thenReturn(Optional.of(verifiedSender()));
        when(userRepository.findById(recipientId)).thenReturn(Optional.of(activeUser(recipientId)));

        EnvelopeResponse response = service.preview(gift.getClaimCode(), UUID.randomUUID());

        assertNull(response.getAmount());
        assertFalse(response.getOpenable());
        assertEquals("NOT_YOURS", response.getBlockedReason());
    }

    // ── Expiry ────────────────────────────────────────────────────────────────

    @Test
    void expire_returnsTheWholeGiftToTheSender() {
        RedEnvelope gift = unopenedGift("100.00");
        Wallet senderWallet = wallet(senderId, "10.00");
        when(envelopeRepository.findByIdForUpdate(gift.getId())).thenReturn(Optional.of(gift));
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.of(senderWallet));
        when(userRepository.findById(senderId)).thenReturn(Optional.of(verifiedSender()));

        service.expire(gift.getId());

        assertEquals(new BigDecimal("110.00"), senderWallet.getBalance());
        assertEquals(new BigDecimal("100.00"), gift.getRefundedAmount());
        assertEquals(RedEnvelope.Status.EXPIRED_REFUNDED, gift.getStatus());
    }

    @Test
    void expire_anOpenedGift_isANoOp() {
        RedEnvelope gift = unopenedGift("100.00");
        gift.setStatus(RedEnvelope.Status.OPENED);
        Wallet senderWallet = wallet(senderId, "10.00");
        when(envelopeRepository.findByIdForUpdate(gift.getId())).thenReturn(Optional.of(gift));
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.of(senderWallet));

        service.expire(gift.getId());

        // The recipient already has it; refunding would pay the amount out twice.
        assertEquals(new BigDecimal("10.00"), senderWallet.getBalance());
    }

    @Test
    void expire_withNoSenderWallet_throwsAndLeavesTheGiftUnopened() {
        RedEnvelope gift = unopenedGift("100.00");
        when(envelopeRepository.findByIdForUpdate(gift.getId())).thenReturn(Optional.of(gift));
        when(walletRepository.findByUserIdForUpdate(senderId)).thenReturn(Optional.empty());

        assertThrows(AppException.class, () -> service.expire(gift.getId()));
        // Left for the next sweep rather than marked settled when the money went nowhere.
        assertEquals(RedEnvelope.Status.UNOPENED, gift.getStatus());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void stubOpen(RedEnvelope gift, User opener, Wallet openerWallet) {
        // Every real gift is sent with a ledger row, so every hand-built one gets one too.
        if (gift.getTransactionId() == null) escrowFor(gift);
        when(envelopeRepository.findByClaimCodeForUpdate(gift.getClaimCode())).thenReturn(Optional.of(gift));
        when(walletRepository.findByUserIdForUpdate(opener.getId())).thenReturn(Optional.of(openerWallet));
        when(userRepository.findById(opener.getId())).thenReturn(Optional.of(opener));
        when(userRepository.findById(senderId)).thenReturn(Optional.of(verifiedSender()));
        when(userRepository.findById(recipientId)).thenReturn(Optional.of(activeUser(recipientId)));
    }

    /** The pending row {@code create} would have written for a hand-built gift. */
    private Transaction escrowFor(RedEnvelope gift) {
        Transaction escrow = Transaction.builder()
                .id(UUID.randomUUID())
                .senderId(gift.getSenderId())
                .recipientId(gift.getRecipientId())
                .amount(gift.getAmount())
                .type(Transaction.TransactionType.TRANSFER)
                .status(Transaction.TransactionStatus.PENDING)
                .build();
        ledger.put(escrow.getId(), escrow);
        gift.setTransactionId(escrow.getId());
        return escrow;
    }

    private RedEnvelope unopenedGift(String amount) {
        return RedEnvelope.builder()
                .id(UUID.randomUUID())
                .claimCode("CODE" + UUID.randomUUID().toString().substring(0, 6).toUpperCase())
                .senderId(senderId)
                .recipientId(recipientId)
                .amount(new BigDecimal(amount))
                .currency("GHS")
                .refundedAmount(BigDecimal.ZERO)
                .occasion(RedEnvelope.Occasion.BIRTHDAY)
                .status(RedEnvelope.Status.UNOPENED)
                .expiresAt(LocalDateTime.now().plusHours(24))
                .build();
    }

    private CreateEnvelopeRequest request(String amount) {
        CreateEnvelopeRequest req = new CreateEnvelopeRequest();
        req.setRecipient("@kofi");
        req.setPasscode("1234");
        req.setAmount(new BigDecimal(amount));
        req.setOccasion("BIRTHDAY");
        req.setIdempotencyKey(UUID.randomUUID().toString());
        return req;
    }

    private User verifiedSender() {
        return User.builder()
                .id(senderId).firstName("Ama").lastName("Mensah")
                .status(User.AccountStatus.ACTIVE).kycStatus(User.KycStatus.VERIFIED)
                .customSingleTransactionLimitGhs(new BigDecimal("10000"))
                .customDailyLimitGhs(new BigDecimal("50000"))
                .build();
    }

    private User activeUser(UUID id) {
        return User.builder()
                .id(id).firstName("Kofi").lastName("Owusu")
                .status(User.AccountStatus.ACTIVE).kycStatus(User.KycStatus.VERIFIED)
                .kycTier(KycTier.TIER_3)
                .build();
    }

    private Wallet wallet(UUID userId, String balance) {
        return Wallet.builder()
                .userId(userId).balance(new BigDecimal(balance)).currency("GHS").frozen(false).build();
    }
}
