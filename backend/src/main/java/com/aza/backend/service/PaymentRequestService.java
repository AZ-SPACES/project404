package com.aza.backend.service;

import com.aza.backend.dto.chat.ChatFinancialSummary;
import com.aza.backend.dto.chat.PaymentRequestMessageRequest;
import com.aza.backend.dto.chat.PaymentRequestResponse;
import com.aza.backend.dto.websocket.WebSocketEventType;
import com.aza.backend.entity.Chat;
import com.aza.backend.entity.PaymentRequest;
import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.User;
import com.aza.backend.entity.Wallet;
import com.aza.backend.repository.BlockedUserRepository;
import com.aza.backend.repository.ChatRepository;
import com.aza.backend.repository.PaymentRequestRepository;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.WalletRepository;
import com.aza.backend.util.SmsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import com.aza.backend.exception.AppException;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentRequestService {

    private final PaymentRequestRepository paymentRequestRepository;
    private final ChatRepository chatRepository;
    private final WalletRepository walletRepository;
    private final WalletLedger walletLedger;
    private final TransactionRepository transactionRepository;
    private final UserRepository userRepository;
    private final BlockedUserRepository blockedUserRepository;
    private final WebSocketPublisher webSocketPublisher;
    private final NotificationService notificationService;
    private final UserService userService;
    private final SmsService smsService;
    private final AnomalyDetectionService anomalyDetectionService;
    private final RiskEngineService riskEngineService;
    private final LimitGuard limitGuard;
    private final FeeCalculationService feeCalculationService;

    private static final ZoneId GHANA_TZ = ZoneId.of("Africa/Accra");

    @Value("${transfer.max-single-amount:10000}")
    private BigDecimal maxSingleAmount;

    @Value("${transfer.max-daily-amount:50000}")
    private BigDecimal maxDailyAmount;

    // ==================== SEND PAYMENT REQUEST ====================

    @Transactional
    public PaymentRequestResponse sendPaymentRequest(User requester, PaymentRequestMessageRequest req) {
        if (requester.getStatus() != User.AccountStatus.ACTIVE) {
            throw new AppException("Your account is not active");
        }
        if (requester.getKycStatus() != User.KycStatus.VERIFIED) {
            throw new AppException("KYC verification required before sending payment requests");
        }

        Chat chat = chatRepository.findById(req.getChatId())
                .orElseThrow(() -> new AppException("Chat not found"));

        assertParticipant(chat, requester.getId());

        UUID payerId = getOtherParticipantId(chat, requester.getId());

        if (blockedUserRepository.existsBlockBetween(requester.getId(), payerId)) {
            throw new AppException("Cannot send payment request to this user");
        }

        if (req.getAmount().compareTo(maxSingleAmount) > 0) {
            throw new AppException("Amount exceeds maximum payment request limit of GHS " + maxSingleAmount);
        }

        LocalDateTime expiresAt = req.getExpiresInHours() != null
                ? LocalDateTime.now().plusHours(req.getExpiresInHours())
                : null;

        PaymentRequest paymentRequest = PaymentRequest.builder()
                .chatId(req.getChatId())
                .requesterId(requester.getId())
                .payerId(payerId)
                .amount(req.getAmount())
                .currency("GHS")
                .note(req.getNote())
                .expiresAt(expiresAt)
                .build();

        paymentRequest = paymentRequestRepository.save(paymentRequest);

        // No chat message is written here. Threads are end-to-end encrypted and the
        // server has no key, so a card it wrote would reach the reader as a failed
        // decryption rather than a request. The client seals its own card pointing at
        // this id — the same split Akyede uses.

        PaymentRequestResponse response = toResponse(paymentRequest);

        webSocketPublisher.publishToChatRoom(
                chat.getParticipantOneId(), chat.getParticipantTwoId(),
                WebSocketEventType.PAYMENT_REQUEST_RECEIVED, response);

        // FCM push to payer (respects silent hours with an amount threshold)
        String requesterName = requester.getFirstName() + " " + requester.getLastName();
        notificationService.sendPaymentRequestReceivedNotification(
                payerId, requesterName, req.getAmount(), paymentRequest.getId().toString());

        log.info("Payment request {} sent in chat {} by {} to {}",
                paymentRequest.getId(), req.getChatId(), requester.getId(), payerId);
        return response;
    }

    /**
     * Read one request. Only the two people it is between may see it — the card in the
     * thread is theirs, and a request id is not a licence for anyone else to read it.
     */
    @Transactional(readOnly = true)
    public PaymentRequestResponse getPaymentRequest(User viewer, UUID id) {
        PaymentRequest pr = paymentRequestRepository.findById(id)
                .orElseThrow(() -> new AppException("Payment request not found"));
        if (!pr.getRequesterId().equals(viewer.getId()) && !pr.getPayerId().equals(viewer.getId())) {
            throw new AppException("Not authorized — this request is not yours");
        }
        return toResponse(pr);
    }

    // ==================== APPROVE ====================

    @Transactional
    public PaymentRequestResponse approvePaymentRequest(User payer, UUID id, String passcode) {
        // Locked, not a plain read. Approving settles the request and moves money, and the
        // PENDING check below is a read-modify-write on this row: a double-tapped approve
        // would otherwise pass it twice and pay the requester twice.
        PaymentRequest pr = paymentRequestRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new AppException("Payment request not found"));

        if (!pr.getPayerId().equals(payer.getId())) {
            throw new AppException("Not authorized — this request is not addressed to you");
        }
        if (pr.getStatus() != PaymentRequest.PaymentRequestStatus.PENDING) {
            throw new AppException("Payment request is no longer pending");
        }
        if (pr.getExpiresAt() != null && LocalDateTime.now().isAfter(pr.getExpiresAt())) {
            pr.setStatus(PaymentRequest.PaymentRequestStatus.EXPIRED);
            paymentRequestRepository.save(pr);
            throw new AppException("Payment request has expired");
        }

        if (payer.getStatus() != User.AccountStatus.ACTIVE) {
            throw new AppException("Your account is not active");
        }
        if (payer.getKycStatus() != User.KycStatus.VERIFIED) {
            throw new AppException("KYC verification required before sending payments");
        }

        userService.verifyPasscode(payer, passcode);

        // Enforce daily transfer limit — the same cap applies regardless of transfer path
        LocalDateTime startOfDay = LocalDate.now(GHANA_TZ).atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1);
        BigDecimal todayTotal = transactionRepository.getTotalSentToday(
                payer.getId(), startOfDay, endOfDay, LocalDateTime.now(GHANA_TZ));
        if (todayTotal.add(pr.getAmount()).compareTo(maxDailyAmount) > 0) {
            BigDecimal remaining = maxDailyAmount.subtract(todayTotal);
            throw new AppException("Payment would exceed your daily limit. Remaining: GHS " + remaining);
        }

        // Pessimistic lock both wallets
        Wallet payerWallet = walletRepository.findByUserIdForUpdate(payer.getId())
                .orElseThrow(() -> new AppException("Payer wallet not found"));
        Wallet requesterWallet = walletRepository.findByUserIdForUpdate(pr.getRequesterId())
                .orElseThrow(() -> new AppException("Requester wallet not found"));

        if (Boolean.TRUE.equals(payerWallet.getFrozen())) {
            throw new AppException("Your wallet has been frozen. Please contact support.");
        }

        // The payer's KYC tier cap. The flat daily cap above is a separate, global limit;
        // without this, settling a chat request was a way around the per-transaction cap
        // that every other transfer path applies.
        limitGuard.enforceSingle(payer, pr.getAmount());

        // The same P2P fee an ordinary transfer of this amount would pay. Settling a
        // request moves money exactly like a transfer, so charging nothing here made a
        // chat request a free route around P2P pricing -- the very thing the equivalent
        // path in TransferService charges the fee to prevent.
        BigDecimal fee = feeCalculationService.quote("P2P", pr.getAmount(), payer.getId()).fee();

        if (payerWallet.getBalance().compareTo(pr.getAmount().add(fee)) < 0) {
            throw new AppException("Insufficient balance to cover the amount plus the GHS "
                    + fee.toPlainString() + " fee");
        }

        // Both wallets are already locked in canonical order above.
        walletLedger.transferLocked(payerWallet, requesterWallet, pr.getAmount(), fee, null);
        feeCalculationService.recordMonthlyUsage("P2P", pr.getAmount(), payer.getId());

        // Scored for the fraud queues; chat payment requests complete inline (the
        // PAID status/chat flow can't park mid-payment) so HIGH alerts rather than holds.
        AnomalyDetectionService.Result anomaly;
        try {
            anomaly = anomalyDetectionService.score(payer.getId(), pr.getRequesterId(), pr.getAmount(), LocalDateTime.now());
        } catch (Exception e) {
            anomaly = new AnomalyDetectionService.Result(0.0, "LOW", null);
        }

        Transaction transaction = Transaction.builder()
                .senderId(payer.getId())
                .recipientId(pr.getRequesterId())
                .amount(pr.getAmount())
                .feeAmount(fee)
                .note(pr.getNote())
                .type(Transaction.TransactionType.TRANSFER)
                .status(Transaction.TransactionStatus.COMPLETED)
                .completedAt(LocalDateTime.now())
                .anomalyScore(anomaly.score())
                .anomalyRiskLevel(anomaly.riskLevel())
                .build();
        transaction = transactionRepository.save(transaction);
        riskEngineService.evaluateTransfer(transaction, payer);

        pr.setStatus(PaymentRequest.PaymentRequestStatus.PAID);
        pr.setPaidAt(LocalDateTime.now());
        pr.setTransactionId(transaction.getId());
        pr = paymentRequestRepository.save(pr);

        PaymentRequestResponse response = toResponse(pr);

        Chat approvedChat = chatRepository.findById(pr.getChatId())
                .orElseThrow(() -> new AppException("Chat not found"));
        webSocketPublisher.publishToChatRoom(
                approvedChat.getParticipantOneId(), approvedChat.getParticipantTwoId(),
                WebSocketEventType.PAYMENT_REQUEST_PAID, response);

        String payerName = payer.getFirstName() + " " + payer.getLastName();
        notificationService.sendPaymentRequestPaidNotification(
                pr.getRequesterId(), payerName, pr.getAmount(), pr.getId().toString());
        notificationService.sendMoneyReceivedNotification(
                pr.getRequesterId(), payerName,
                pr.getAmount().toString(), transaction.getId().toString());

        User requester = userService.findById(pr.getRequesterId());
        if (requester.getPhoneNumber() != null && !requester.getPhoneNumber().isBlank()) {
            smsService.sendPaymentRequestPaidSms(requester.getPhoneNumber(), payerName, pr.getAmount());
        }

        log.info("Payment request {} approved by {} — transaction {}", id, payer.getId(), transaction.getId());
        return response;
    }

    // ==================== DECLINE ====================

    @Transactional
    public PaymentRequestResponse declinePaymentRequest(User payer, UUID id) {
        PaymentRequest pr = paymentRequestRepository.findById(id)
                .orElseThrow(() -> new AppException("Payment request not found"));

        if (!pr.getPayerId().equals(payer.getId())) {
            throw new AppException("Not authorized");
        }
        if (pr.getStatus() != PaymentRequest.PaymentRequestStatus.PENDING) {
            throw new AppException("Payment request is no longer pending");
        }

        pr.setStatus(PaymentRequest.PaymentRequestStatus.DECLINED);
        pr.setDeclinedAt(LocalDateTime.now());
        pr = paymentRequestRepository.save(pr);

        PaymentRequestResponse response = toResponse(pr);

        Chat declinedChat = chatRepository.findById(pr.getChatId())
                .orElseThrow(() -> new AppException("Chat not found"));
        webSocketPublisher.publishToChatRoom(
                declinedChat.getParticipantOneId(), declinedChat.getParticipantTwoId(),
                WebSocketEventType.PAYMENT_REQUEST_DECLINED, response);

        String payerName = payer.getFirstName() + " " + payer.getLastName();
        notificationService.sendPaymentRequestDeclinedNotification(
                pr.getRequesterId(), payerName, pr.getAmount(), pr.getId().toString());

        log.info("Payment request {} declined by {}", id, payer.getId());
        return response;
    }

    // ==================== CANCEL ====================

    @Transactional
    public PaymentRequestResponse cancelPaymentRequest(User requester, UUID id) {
        PaymentRequest pr = paymentRequestRepository.findById(id)
                .orElseThrow(() -> new AppException("Payment request not found"));

        if (!pr.getRequesterId().equals(requester.getId())) {
            throw new AppException("Not authorized — only the requester can cancel");
        }
        if (pr.getStatus() != PaymentRequest.PaymentRequestStatus.PENDING) {
            throw new AppException("Payment request is no longer pending");
        }

        pr.setStatus(PaymentRequest.PaymentRequestStatus.CANCELLED);
        pr.setCancelledAt(LocalDateTime.now());
        pr = paymentRequestRepository.save(pr);

        PaymentRequestResponse response = toResponse(pr);

        Chat cancelledChat = chatRepository.findById(pr.getChatId())
                .orElseThrow(() -> new AppException("Chat not found"));
        webSocketPublisher.publishToChatRoom(
                cancelledChat.getParticipantOneId(), cancelledChat.getParticipantTwoId(),
                WebSocketEventType.PAYMENT_REQUEST_CANCELLED, response);

        String requesterName = requester.getFirstName() + " " + requester.getLastName();
        notificationService.sendPaymentRequestCancelledNotification(
                pr.getPayerId(), requesterName, pr.getAmount(), pr.getId().toString());

        log.info("Payment request {} cancelled by {}", id, requester.getId());
        return response;
    }

    // ==================== EXPIRE (scheduled) ====================

    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void expirePaymentRequests() {
        List<PaymentRequest> expired = paymentRequestRepository
                .findByStatusAndExpiresAtBefore(PaymentRequest.PaymentRequestStatus.PENDING, LocalDateTime.now());

        for (PaymentRequest pr : expired) {
            pr.setStatus(PaymentRequest.PaymentRequestStatus.EXPIRED);
            paymentRequestRepository.save(pr);

            PaymentRequestResponse response = toResponse(pr);
            chatRepository.findById(pr.getChatId()).ifPresent(chat ->
                webSocketPublisher.publishToChatRoom(
                        chat.getParticipantOneId(), chat.getParticipantTwoId(),
                        WebSocketEventType.PAYMENT_REQUEST_EXPIRED, response));

            notificationService.sendPaymentRequestExpiredNotification(
                    pr.getRequesterId(), pr.getAmount(), pr.getId().toString());
            notificationService.sendPaymentRequestExpiredNotification(
                    pr.getPayerId(), pr.getAmount(), pr.getId().toString());
        }

        if (!expired.isEmpty()) {
            log.info("Expired {} payment request(s)", expired.size());
        }
    }

    // ==================== FINANCIAL SUMMARY ====================

    public ChatFinancialSummary getChatFinancialSummary(User user, UUID chatId) {
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new AppException("Chat not found"));
        assertParticipant(chat, user.getId());

        UUID otherUserId = getOtherParticipantId(chat, user.getId());

        BigDecimal totalPaid = paymentRequestRepository.sumPaidByUser(chatId, user.getId());
        BigDecimal totalReceived = paymentRequestRepository.sumReceivedByUser(chatId, user.getId());
        BigDecimal net = totalReceived.subtract(totalPaid);

        List<PaymentRequest> allRequests =
                paymentRequestRepository.findAllByChatIdOrderByCreatedAtDesc(chatId);

        long totalCount = allRequests.size();
        long pendingCount = allRequests.stream()
                .filter(r -> r.getStatus() == PaymentRequest.PaymentRequestStatus.PENDING)
                .count();
        long paidCount = allRequests.stream()
                .filter(r -> r.getStatus() == PaymentRequest.PaymentRequestStatus.PAID)
                .count();

        List<ChatFinancialSummary.PaymentActivityItem> recent = allRequests.stream()
                .limit(10)
                .map(pr -> ChatFinancialSummary.PaymentActivityItem.builder()
                        .id(pr.getId().toString())
                        .amount(pr.getAmount())
                        .currency(pr.getCurrency())
                        .note(pr.getNote())
                        .status(pr.getStatus().name())
                        .requestedByMe(pr.getRequesterId().equals(user.getId()))
                        .createdAt(pr.getCreatedAt() != null ? pr.getCreatedAt().toString() : null)
                        .paidAt(pr.getPaidAt() != null ? pr.getPaidAt().toString() : null)
                        .build())
                .toList();

        return ChatFinancialSummary.builder()
                .chatId(chatId.toString())
                .otherUserId(otherUserId.toString())
                .currency("GHS")
                .totalPaidByMe(totalPaid)
                .totalReceivedByMe(totalReceived)
                .netBalance(net)
                .totalPaymentRequests(totalCount)
                .pendingPaymentRequests(pendingCount)
                .paidPaymentRequests(paidCount)
                .recentActivity(recent)
                .build();
    }

    // ==================== HELPERS ====================

    public PaymentRequestResponse toResponse(PaymentRequest pr) {
        return PaymentRequestResponse.builder()
                .id(pr.getId().toString())
                .chatId(pr.getChatId().toString())
                .requesterId(pr.getRequesterId().toString())
                .payerId(pr.getPayerId().toString())
                .amount(pr.getAmount())
                .currency(pr.getCurrency())
                .note(pr.getNote())
                .status(pr.getStatus().name())
                .transactionId(pr.getTransactionId() != null
                        ? pr.getTransactionId().toString() : null)
                .expiresAt(pr.getExpiresAt() != null ? pr.getExpiresAt().toString() : null)
                .paidAt(pr.getPaidAt() != null ? pr.getPaidAt().toString() : null)
                .declinedAt(pr.getDeclinedAt() != null ? pr.getDeclinedAt().toString() : null)
                .cancelledAt(pr.getCancelledAt() != null ? pr.getCancelledAt().toString() : null)
                .createdAt(pr.getCreatedAt() != null ? pr.getCreatedAt().toString() : null)
                .build();
    }

    private void assertParticipant(Chat chat, UUID userId) {
        if (!chat.getParticipantOneId().equals(userId) &&
                !chat.getParticipantTwoId().equals(userId)) {
            throw new AppException("Not authorized to access this chat");
        }
    }

    private UUID getOtherParticipantId(Chat chat, UUID userId) {
        return chat.getParticipantOneId().equals(userId)
                ? chat.getParticipantTwoId()
                : chat.getParticipantOneId();
    }
}
