package com.aza.backend.service;

import com.aza.backend.dto.transfer.*;
import com.aza.backend.entity.AuditLog;
import com.aza.backend.dto.websocket.WebSocketEventType;
import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.User;
import com.aza.backend.entity.Wallet;
import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.CheckoutSession;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.WalletRepository;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.repository.CheckoutSessionRepository;
import com.aza.backend.exception.AppException;
import org.springframework.http.HttpStatus;
import com.aza.backend.util.EmailService;
import com.aza.backend.util.RateLimitService;
import com.aza.backend.util.SmsService;
import com.aza.backend.repository.MerchantNotificationPreferenceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.RoundingMode;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TransferService {

    private final TransactionRepository transactionRepository;
    private final WalletRepository walletRepository;
    private final UserRepository userRepository;
    private final UserService userService;
    private final MerchantRepository merchantRepository;
    private final CheckoutSessionRepository sessionRepository;
    private final CheckoutService checkoutService;
    private final RateLimitService rateLimitService;
    private final WebSocketPublisher webSocketPublisher;
    private final NotificationService notificationService;
    private final EmailService emailService;
    private final SmsService smsService;
    private final MerchantNotificationPreferenceRepository merchantNotificationPrefRepository;
    private final AnomalyDetectionService anomalyDetectionService;
    private final AuditService auditService;

    @Value("${transfer.max-single-amount:10000}")
    private BigDecimal maxSingleAmount;

    @Value("${transfer.max-daily-amount:50000}")
    private BigDecimal maxDailyAmount;

    private static final ZoneId GHANA_TZ = ZoneId.of("Africa/Accra");

    // ── Recipient resolution helpers (used by anomaly + category endpoints) ────

    public Optional<UUID> resolveRecipientId(String rawIdentifier) {
        String candidate = rawIdentifier.startsWith("@") ? rawIdentifier.substring(1) : rawIdentifier;
        return userRepository.findByEmailOrPhoneNumber(rawIdentifier, rawIdentifier)
                .map(User::getId)
                .or(() -> userRepository.findByUsername(candidate).map(User::getId))
                .or(() -> merchantRepository.findByBusinessHandle(candidate).map(Merchant::getId));
    }

    public Optional<String> resolveRecipientName(String rawIdentifier) {
        String candidate = rawIdentifier.startsWith("@") ? rawIdentifier.substring(1) : rawIdentifier;
        return userRepository.findByEmailOrPhoneNumber(rawIdentifier, rawIdentifier)
                .map(u -> u.getFirstName() + " " + u.getLastName())
                .or(() -> userRepository.findByUsername(candidate)
                        .map(u -> u.getFirstName() + " " + u.getLastName()))
                .or(() -> merchantRepository.findByBusinessHandle(candidate)
                        .map(Merchant::getBusinessName));
    }

    // WALLET

    public WalletResponse getBalance(UUID userId) {
        Wallet wallet = walletRepository.findByUserId(userId)
                .orElseThrow(() -> new AppException("Wallet not found"));

        return WalletResponse.builder()
                .balance(wallet.getBalance())
                .currency(wallet.getCurrency())
                .lastUpdatedAt(wallet.getLastUpdatedAt() != null
                        ? wallet.getLastUpdatedAt().toString() : null)
                .build();
    }

    public SpendingResponse getSpendingSummary(UUID userId) {
        LocalDateTime now = LocalDateTime.now(GHANA_TZ);
        
        LocalDateTime startOfThisMonth = now.withDayOfMonth(1).toLocalDate().atStartOfDay();
        LocalDateTime startOfNextMonth = startOfThisMonth.plusMonths(1);
        
        LocalDateTime startOfLastMonth = startOfThisMonth.minusMonths(1);
        
        BigDecimal spentThisMonth = transactionRepository.getTotalSpentBetween(userId, startOfThisMonth, startOfNextMonth);
        BigDecimal spentLastMonth = transactionRepository.getTotalSpentBetween(userId, startOfLastMonth, startOfThisMonth);
        
        return SpendingResponse.builder()
                .spentThisMonth(spentThisMonth)
                .spentLastMonth(spentLastMonth)
                .currency("GHS")
                .build();
    }

    public BigDecimal getTodaySent(UUID userId) {
        LocalDateTime startOfDay = LocalDate.now(GHANA_TZ).atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1);
        return transactionRepository.getTotalSentToday(userId, startOfDay, endOfDay, LocalDateTime.now(GHANA_TZ));
    }

    public YearlySpendingResponse getYearlySpendingSummary(UUID userId, int year) {
        String[] monthNames = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
        java.util.Map<String, YearlySpendingResponse.MonthSpending> monthsMap = new java.util.LinkedHashMap<>();
        
        BigDecimal totalSpentYear = BigDecimal.ZERO;
        int currentMonthValue = LocalDateTime.now(GHANA_TZ).getYear() == year ? LocalDateTime.now(GHANA_TZ).getMonthValue() : 12;

        for (int i = 1; i <= 12; i++) {
            LocalDateTime startOfMonth = LocalDateTime.of(year, i, 1, 0, 0);
            LocalDateTime endOfMonth = startOfMonth.plusMonths(1);
            
            BigDecimal spentMonth = transactionRepository.getTotalSpentBetween(userId, startOfMonth, endOfMonth);
            totalSpentYear = totalSpentYear.add(spentMonth);
            
            monthsMap.put(monthNames[i - 1], YearlySpendingResponse.MonthSpending.builder()
                    .spent(spentMonth)
                    .avg(BigDecimal.ZERO)
                    .build());
        }
        
        BigDecimal avg = totalSpentYear.divide(BigDecimal.valueOf(currentMonthValue), 2, java.math.RoundingMode.HALF_UP);
        
        for (String month : monthNames) {
            monthsMap.get(month).setAvg(avg);
        }

        return YearlySpendingResponse.builder()
                .months(monthsMap)
                .currency("GHS")
                .build();
    }

    // INITIATE TRANSFER

    @Transactional
    public TransferResponse initiateTransfer(User sender, TransferRequest request) {
        Optional<Transaction> existing = transactionRepository
                .findByIdempotencyKey(request.getIdempotencyKey());
        if (existing.isPresent()) {
            Transaction t = existing.get();
            if(!t.getSenderId().equals(sender.getId())) {
                throw new AppException("Invalid idempotency key");
            }
            User recipient = userRepository.findById(t.getRecipientId()).orElse(null);
            return buildTransferResponse(t, sender, recipient, sender.getId());
        }
        rateLimitService.enforceRateLimit("transfer:" + sender.getId(), 20, Duration.ofHours(1));

        if(sender.getStatus() != User.AccountStatus.ACTIVE) {
            throw new AppException("Your account is not active");
        }

        if(sender.getKycStatus() !=User.KycStatus.VERIFIED) {
            throw new AppException("KYC verification required before transfer");
        }

        BigDecimal effectiveSingleLimit = sender.getCustomSingleTransactionLimitGhs() != null
                ? sender.getCustomSingleTransactionLimitGhs() : maxSingleAmount;
        BigDecimal effectiveDailyLimit = sender.getCustomDailyLimitGhs() != null
                ? sender.getCustomDailyLimitGhs() : maxDailyAmount;

        if(request.getAmount().compareTo(effectiveSingleLimit) > 0) {
            throw new AppException("Amount exceeds max single transfer limit of GHS " + effectiveSingleLimit);
        }

        LocalDateTime startOfDay = LocalDate.now(GHANA_TZ).atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1);
        BigDecimal todayTotal = transactionRepository.getTotalSentToday(
                sender.getId(), startOfDay, endOfDay, LocalDateTime.now(GHANA_TZ)
        );
        if (todayTotal.add(request.getAmount()).compareTo(effectiveDailyLimit) > 0) {
            BigDecimal remaining = effectiveDailyLimit.subtract(todayTotal);
            throw new AppException("Transfer would exceed your daily limit. Remaining: GHS " + remaining);
        }

        // 2. Find recipient — try email/phone first, then handle
        String rawIdentifier = request.getRecipientIdentifier();
        String usernameCandidate = rawIdentifier.startsWith("@")
                ? rawIdentifier.substring(1) : rawIdentifier;
        User recipient = userRepository
                .findByEmailOrPhoneNumber(rawIdentifier, rawIdentifier)
                .or(() -> userRepository.findByUsername(usernameCandidate))
                .orElse(null);

        UUID recipientId;
        if (recipient != null) {
            if (recipient.getId().equals(sender.getId())) {
                throw new AppException("Cannot transfer to yourself");
            }
            if (recipient.getStatus() != User.AccountStatus.ACTIVE) {
                throw new AppException("Recipient account is not available");
            }
            recipientId = recipient.getId();
        } else {
            // Try to find a merchant with this handle
            Merchant merchant = merchantRepository.findByBusinessHandle(usernameCandidate)
                    .orElseThrow(() -> new AppException("Recipient not found"));
            if (merchant.getStatus() != Merchant.MerchantStatus.ACTIVE) {
                throw new AppException("Recipient account is not available");
            }
            if (merchant.getUserId().equals(sender.getId())) {
                throw new AppException("Cannot transfer to yourself");
            }
            recipientId = merchant.getId();
        }

        // 3. Check sender balance
        Wallet senderWallet = walletRepository.findByUserId(sender.getId())
                .orElseThrow(() -> new AppException("Wallet not found"));

        if (Boolean.TRUE.equals(senderWallet.getFrozen())) {
            throw new AppException("WALLET_FROZEN", "Your wallet has been frozen. Please contact support.", HttpStatus.FORBIDDEN);
        }

        validateBalance(senderWallet, request.getAmount());

        // 4. Create a pending transaction
        Transaction.TransactionCategory txCategory = null;
        if (request.getCategory() != null && !request.getCategory().isBlank()) {
            try { txCategory = Transaction.TransactionCategory.valueOf(request.getCategory().toUpperCase()); }
            catch (IllegalArgumentException ignored) { txCategory = Transaction.TransactionCategory.OTHERS; }
        }

        AnomalyDetectionService.Result anomaly;
        try {
            anomaly = anomalyDetectionService.score(sender.getId(), recipientId, request.getAmount(), LocalDateTime.now());
        } catch (Exception e) {
            anomaly = new AnomalyDetectionService.Result(0.0, "LOW", null);
        }

        Transaction transaction = Transaction.builder()
                .senderId(sender.getId())
                .recipientId(recipientId)
                .amount(request.getAmount())
                .note(request.getNote())
                .type(Transaction.TransactionType.TRANSFER)
                .status(Transaction.TransactionStatus.PENDING)
                .idempotencyKey(request.getIdempotencyKey())
                .expiresAt(LocalDateTime.now().plusMinutes(10))
                .category(txCategory)
                .anomalyScore(anomaly.score())
                .anomalyRiskLevel(anomaly.riskLevel())
                .build();

        transaction = transactionRepository.save(transaction);
        return buildTransferResponse(transaction, sender, recipient, sender.getId());
    }

    // ==================== CONFIRM TRANSFER (with PIN) ====================

    @Transactional
    public TransferResponse confirmTransfer(User sender, UUID transactionId, String passcode) {
        if (sender.getStatus() != User.AccountStatus.ACTIVE) {
            throw new AppException("Your account is not active");
        }
        //Verify passcode
        userService.verifyPasscode(sender, passcode);

        // Find the pending transaction
        Transaction transaction = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new AppException("Transaction not found"));

        if (!transaction.getSenderId().equals(sender.getId())) {
            throw new AppException("Not authorized to confirm this transaction");
        }
        if (transaction.getStatus() == Transaction.TransactionStatus.COMPLETED) {
            User recipient = userRepository.findById(transaction.getRecipientId()).orElse(null);
            return buildTransferResponse(transaction, sender, recipient, sender.getId());
        }
        if (transaction.getStatus() != Transaction.TransactionStatus.PENDING) {
            throw new AppException("Transaction cannot be confirmed - status: " + transaction.getStatus().name());
        }

        if (transaction.getExpiresAt() != null && LocalDateTime.now().isAfter(transaction.getExpiresAt())) {
            transaction.setStatus(Transaction.TransactionStatus.CANCELLED);
            transactionRepository.save(transaction);
            throw new AppException("Transaction has expired. Please initiate a new transfer.");
        }

        //Lock sender wallet and execute transfer atomically
        Wallet senderWallet = walletRepository.findByUserIdForUpdate(sender.getId())
                .orElseThrow(() -> new AppException("Sender wallet not found"));

        if (Boolean.TRUE.equals(senderWallet.getFrozen())) {
            throw new AppException("WALLET_FROZEN", "Your wallet has been frozen. Please contact support.", HttpStatus.FORBIDDEN);
        }

        // Re-check balance (could have changed since initiation)
        if (senderWallet.getBalance().compareTo(transaction.getAmount()) < 0) {
            transaction.setStatus(Transaction.TransactionStatus.FAILED);
            transactionRepository.save(transaction);
            throw new AppException("Insufficient balance");
        }

        Merchant merchant = merchantRepository.findByIdForUpdate(transaction.getRecipientId()).orElse(null);
        if (merchant != null) {
            // Debit sender
            senderWallet.setBalance(senderWallet.getBalance().subtract(transaction.getAmount()));
            walletRepository.save(senderWallet);
            sender.setBalance(senderWallet.getBalance());
            userRepository.save(sender);

            // Credit merchant
            BigDecimal feeRate = BigDecimal.valueOf(merchant.getFeeRateBps()).divide(BigDecimal.valueOf(10_000), 6, RoundingMode.HALF_UP);
            BigDecimal platformFee = transaction.getAmount().multiply(feeRate).setScale(2, RoundingMode.HALF_UP);
            BigDecimal netAmount = transaction.getAmount().subtract(platformFee);

            merchant.setBalance(merchant.getBalance().add(netAmount));
            merchant.setTotalVolume(merchant.getTotalVolume().add(transaction.getAmount()));
            merchantRepository.save(merchant);

            // Create virtual completed checkout session for webhooks
            CheckoutSession session = CheckoutSession.builder()
                    .merchantId(merchant.getId())
                    .amount(transaction.getAmount())
                    .description(transaction.getNote() != null ? transaction.getNote() : "Store payment")
                    .status(CheckoutSession.SessionStatus.COMPLETED)
                    .platformFee(platformFee)
                    .netAmount(netAmount)
                    .customerId(sender.getId())
                    .completedAt(LocalDateTime.now())
                    .transactionId(transaction.getId())
                    .build();
            sessionRepository.save(session);

            // Queue/Dispatch webhook delivery
            checkoutService.scheduleWebhookDelivery(session, merchant);

            // Mark transaction complete
            transaction.setStatus(Transaction.TransactionStatus.COMPLETED);
            LocalDateTime completedAt = LocalDateTime.now();
            transaction.setCompletedAt(completedAt);
            transactionRepository.save(transaction);

            webSocketPublisher.publishNotification(merchant.getUserId(), WebSocketEventType.TRANSFER_UPDATE,
                    Map.of(
                            "transactionId", transaction.getId().toString(),
                            "amount", transaction.getAmount().toString(),
                            "from", sender.getFirstName() + " " + sender.getLastName(),
                            "note", transaction.getNote() != null ? transaction.getNote() : ""
                    ));

            notificationService.sendMoneyReceivedNotification(
                    merchant.getUserId(),
                    sender.getFirstName() + " " + sender.getLastName(),
                    transaction.getAmount().toString(),
                    transaction.getId().toString());

            String merchantTxnRef = transaction.getId().toString().substring(28).toUpperCase();
            emailService.sendTransferSentEmail(sender.getEmail(), sender.getFirstName(),
                    merchant.getBusinessName(), transaction.getAmount(), merchantTxnRef);
            if (sender.getPhoneNumber() != null && !sender.getPhoneNumber().isBlank()) {
                smsService.sendTransferSentSms(sender.getPhoneNumber(), merchant.getBusinessName(),
                        transaction.getAmount(), merchantTxnRef, senderWallet.getBalance(),
                        transaction.getNote(), transaction.getId().toString(), BigDecimal.ZERO, BigDecimal.ZERO);
            }

            boolean emailPaymentReceived = merchantNotificationPrefRepository
                    .findByMerchantId(merchant.getId())
                    .map(p -> p.isEmailPaymentReceived())
                    .orElse(true);
            if (emailPaymentReceived) {
                userRepository.findById(merchant.getUserId()).ifPresent(merchantOwner ->
                    emailService.sendMerchantPaymentReceivedEmail(
                            merchantOwner.getEmail(), merchantOwner.getFirstName(),
                            merchant.getBusinessName(), transaction.getAmount(),
                            sender.getFirstName() + " " + sender.getLastName(), merchantTxnRef));
            }

            return buildTransferResponse(transaction, sender, null, sender.getId());
        } else {
            Wallet recipientWallet = walletRepository.findByUserIdForUpdate(transaction.getRecipientId())
                    .orElseThrow(() -> new AppException("Recipient wallet not found"));

            // Debit sender, credit recipient
            senderWallet.setBalance(senderWallet.getBalance().subtract(transaction.getAmount()));
            recipientWallet.setBalance(recipientWallet.getBalance().add(transaction.getAmount()));

            walletRepository.save(senderWallet);
            walletRepository.save(recipientWallet);

            // Update a cached balance in a user table for redundancy/quick lookup
            User recipient = userRepository.findById(transaction.getRecipientId())
                    .orElseThrow(() -> new AppException("Recipient not found"));

            sender.setBalance(senderWallet.getBalance());
            recipient.setBalance(recipientWallet.getBalance());
            userRepository.save(sender);
            userRepository.save(recipient);

            // Mark transaction complete
            transaction.setStatus(Transaction.TransactionStatus.COMPLETED);
            LocalDateTime completedAt = LocalDateTime.now();
            transaction.setCompletedAt(completedAt);
            transactionRepository.save(transaction);

            webSocketPublisher.publishNotification(recipient.getId(), WebSocketEventType.TRANSFER_UPDATE,
                    Map.of(
                            "transactionId", transaction.getId().toString(),
                            "amount", transaction.getAmount().toString(),
                            "from", sender.getFirstName() + " " + sender.getLastName(),
                            "note", transaction.getNote() != null ? transaction.getNote() : ""
                    ));

            notificationService.sendMoneyReceivedNotification(
                    transaction.getRecipientId(),
                    sender.getFirstName() + " " + sender.getLastName(),
                    transaction.getAmount().toString(),
                    transaction.getId().toString());

            String txnRef = transaction.getId().toString().substring(28).toUpperCase();
            String senderFullName = sender.getFirstName() + " " + sender.getLastName();
            String recipientFullName = recipient.getFirstName() + " " + recipient.getLastName();

            emailService.sendTransferSentEmail(sender.getEmail(), sender.getFirstName(),
                    recipientFullName, transaction.getAmount(), txnRef);
            if (sender.getPhoneNumber() != null && !sender.getPhoneNumber().isBlank()) {
                smsService.sendTransferSentSms(sender.getPhoneNumber(), recipientFullName,
                        transaction.getAmount(), txnRef, senderWallet.getBalance(),
                        transaction.getNote(), transaction.getId().toString(), BigDecimal.ZERO, BigDecimal.ZERO);
            }
            if (recipient.getPhoneNumber() != null && !recipient.getPhoneNumber().isBlank()) {
                smsService.sendTransferReceivedSms(recipient.getPhoneNumber(), senderFullName,
                        transaction.getAmount(), txnRef, recipientWallet.getBalance(),
                        transaction.getNote(), transaction.getId().toString(), BigDecimal.ZERO);
            }

            auditService.logWithResource(AuditLog.TRANSFER_COMPLETED, AuditLog.SUCCESS,
                    sender.getId(), sender.getEmail(), null,
                    transaction.getId(), "Transaction");
            return buildTransferResponse(transaction, sender, recipient, sender.getId());
        }
    }

    // ==================== CANCEL TRANSFER ====================

    @Transactional
    public TransferResponse cancelTransfer(User sender, UUID transactionId) {
        Transaction transaction = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new AppException("Transaction not found"));

        if (!transaction.getSenderId().equals(sender.getId())) {
            throw new AppException("Not authorized to cancel this transaction");
        }
        if (transaction.getStatus() != Transaction.TransactionStatus.PENDING) {
            throw new AppException("Only pending transactions can be cancelled");
        }

        transaction.setStatus(Transaction.TransactionStatus.CANCELLED);
        transaction.setCancelledAt(LocalDateTime.now());
        transactionRepository.save(transaction);

        User recipient = userRepository.findById(transaction.getRecipientId())
                .orElseThrow(() -> new AppException("Recipient not found"));

        return buildTransferResponse(transaction, sender, recipient, sender.getId());
    }

    // ==================== MONEY REQUESTS ====================

    @Transactional
    public TransferResponse requestMoney(User requester, MoneyRequestDto request) {
        if (requester.getStatus() != User.AccountStatus.ACTIVE) {
            throw new AppException("Your account is not active");
        }
        if (requester.getKycStatus() != User.KycStatus.VERIFIED) {
            throw new AppException("KYC verification required before requesting money");
        }
        rateLimitService.enforceRateLimit("request:" + requester.getId(), 20, Duration.ofHours(1));

        BigDecimal requesterSingleLimit = requester.getCustomSingleTransactionLimitGhs() != null
                ? requester.getCustomSingleTransactionLimitGhs() : maxSingleAmount;
        if (request.getAmount().compareTo(requesterSingleLimit) > 0) {
            throw new AppException("Requested amount exceeds the single transfer limit of GHS " + requesterSingleLimit);
        }

        // Find the user to request from — try email/phone first, then handle
        String rawFrom = request.getFromIdentifier();
        String usernameCandidate = rawFrom.startsWith("@") ? rawFrom.substring(1) : rawFrom;
        User fromUser = userRepository
                .findByEmailOrPhoneNumber(rawFrom, rawFrom)
                .or(() -> userRepository.findByUsername(usernameCandidate))
                .orElseThrow(() -> new AppException("User not found"));

        if(fromUser.getId().equals(requester.getId())) {
            throw new AppException("Cannot request money from yourself");
        }

        // Idempotency: if key was already used and request is PENDING/COMPLETED, return existing
        if (request.getIdempotencyKey() != null && !request.getIdempotencyKey().isBlank()) {
            Optional<Transaction> existing = transactionRepository.findByIdempotencyKey(request.getIdempotencyKey());
            if (existing.isPresent()) {
                Transaction t = existing.get();
                if (t.getStatus() == Transaction.TransactionStatus.PENDING
                        || t.getStatus() == Transaction.TransactionStatus.COMPLETED) {
                    return buildTransferResponse(t, fromUser, requester, requester.getId());
                }
            }
        }

        Transaction transaction = Transaction.builder()
                .senderId(fromUser.getId())
                .recipientId(requester.getId())
                .amount(request.getAmount())
                .note(request.getNote())
                .type(Transaction.TransactionType.REQUEST)
                .status(Transaction.TransactionStatus.PENDING)
                .isRequest(true)
                .requestedAt(LocalDateTime.now())
                .idempotencyKey(request.getIdempotencyKey() != null && !request.getIdempotencyKey().isBlank()
                        ? request.getIdempotencyKey() : null)
                .build();

        transaction = transactionRepository.save(transaction);

        String requesterName = requester.getFirstName() + " " + requester.getLastName();
        notificationService.sendMoneyReceivedNotification(
                fromUser.getId(), requesterName,
                request.getAmount().toString(), transaction.getId().toString());
        if (fromUser.getPhoneNumber() != null && !fromUser.getPhoneNumber().isBlank()) {
            smsService.sendMoneyRequestedSms(fromUser.getPhoneNumber(), requesterName, request.getAmount());
        }

        return buildTransferResponse(transaction, fromUser, requester, requester.getId());
    }

    @Transactional
    public TransferResponse acceptMoneyRequest(User payer, UUID transactionId, String passcode) {
        if (payer.getStatus() != User.AccountStatus.ACTIVE) {
            throw new AppException("Your account is not active");
        }
        if (payer.getKycStatus() != User.KycStatus.VERIFIED) {
            throw new AppException("KYC verification required before sending money");
        }

        userService.verifyPasscode(payer, passcode);

        Transaction transaction = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new AppException("Transaction not found"));

        if (!transaction.getSenderId().equals(payer.getId())) {
            throw new AppException("Not authorized — this request is not addressed to you");
        }
        if(transaction.getStatus() == Transaction.TransactionStatus.COMPLETED) {
            User requester = userRepository.findById(transaction.getRecipientId()).orElse(null);
            return buildTransferResponse(transaction, payer, requester, payer.getId());
        }

        if (transaction.getStatus() != Transaction.TransactionStatus.PENDING) {
            throw new AppException("Request is no longer pending");
        }

        BigDecimal payerSingleLimit = payer.getCustomSingleTransactionLimitGhs() != null
                ? payer.getCustomSingleTransactionLimitGhs() : maxSingleAmount;
        BigDecimal payerDailyLimit = payer.getCustomDailyLimitGhs() != null
                ? payer.getCustomDailyLimitGhs() : maxDailyAmount;

        if (transaction.getAmount().compareTo(payerSingleLimit) > 0) {
            throw new AppException("Amount exceeds your single transfer limit of GHS " + payerSingleLimit);
        }

        LocalDateTime startOfDay = LocalDate.now(GHANA_TZ).atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1);
        BigDecimal todayTotal = transactionRepository.getTotalSentToday(
                payer.getId(), startOfDay, endOfDay, LocalDateTime.now(GHANA_TZ));
        if (todayTotal.add(transaction.getAmount()).compareTo(payerDailyLimit) > 0) {
            throw new AppException("Accepting this request would exceed your daily transfer limit of GHS " + payerDailyLimit);
        }

        // Execute transfer
        Wallet payerWallet = walletRepository.findByUserIdForUpdate(payer.getId())
                .orElseThrow(() -> new AppException("Wallet not found"));
        Wallet requesterWallet = walletRepository.findByUserIdForUpdate(transaction.getRecipientId())
                .orElseThrow(() -> new AppException("Wallet not found"));

        validateBalance(payerWallet, transaction.getAmount());

        payerWallet.setBalance(payerWallet.getBalance().subtract(transaction.getAmount()));
        requesterWallet.setBalance(requesterWallet.getBalance().add(transaction.getAmount()));
 
        walletRepository.save(payerWallet);
        walletRepository.save(requesterWallet);

        // Update cached balance in a user table
        User requester = userRepository.findById(transaction.getRecipientId())
                .orElseThrow(() -> new AppException("User not found"));

        payer.setBalance(payerWallet.getBalance());
        requester.setBalance(requesterWallet.getBalance());
        userRepository.save(payer);
        userRepository.save(requester);

        transaction.setStatus(Transaction.TransactionStatus.COMPLETED);
        transaction.setAcceptedAt(LocalDateTime.now());
        transaction.setCompletedAt(LocalDateTime.now());
        transactionRepository.save(transaction);


        webSocketPublisher.publishNotification(requester.getId(), WebSocketEventType.TRANSFER_UPDATE,
                Map.of(
                        "transactionId", transaction.getId().toString(),
                        "amount", transaction.getAmount().toString(),
                        "from", payer.getFirstName() + " " + payer.getLastName(),
                        "note", transaction.getNote() != null ? transaction.getNote() : ""
                ));

        return buildTransferResponse(transaction, payer, requester, payer.getId());
    }

    @Transactional
    public TransferResponse declineMoneyRequest(User payer, UUID transactionId) {
        Transaction transaction = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new AppException("Transaction not found"));

        if (!transaction.getSenderId().equals(payer.getId())) {
            throw new AppException("Not authorized");
        }
        if (transaction.getStatus() != Transaction.TransactionStatus.PENDING) {
            throw new AppException("Request is no longer pending");
        }

        transaction.setStatus(Transaction.TransactionStatus.DECLINED);
        transaction.setDeclinedAt(LocalDateTime.now());
        transactionRepository.save(transaction);

        User requester = userRepository.findById(transaction.getRecipientId())
                .orElseThrow(() -> new AppException("User not found"));

        return buildTransferResponse(transaction, payer, requester, payer.getId());
    }

    // ==================== TRANSACTION HISTORY ====================

    public Page<TransferResponse> getTransactionHistory(UUID userId, String type,
                                                         String status, int page, int size) {
        int cappedSize = Math.min(size, 100);
        PageRequest pageRequest = PageRequest.of(page, cappedSize);
        Page<Transaction> transactions;

        if (type != null && !type.isBlank()) {
            try {
                transactions = transactionRepository.findAllByUserIdAndType(
                        userId, Transaction.TransactionType.valueOf(type.toUpperCase()), pageRequest);
            } catch (IllegalArgumentException e ) {
                throw new AppException("Invalid transaction type. Accepted values: TRANSFER, REQUEST");
            }
        } else if (status != null && !status.isBlank()) {
            try {
                transactions = transactionRepository.findAllByUserIdAndStatus(
                        userId, Transaction.TransactionStatus.valueOf(status.toUpperCase()), pageRequest);
            } catch (IllegalArgumentException e) {
                throw new AppException("Invalid status. Accepted values: DRAFT, PENDING, COMPLETED, FAILED, CANCELLED, DECLINED");
            }
        } else {
            transactions = transactionRepository.findAllByUserId(userId, pageRequest);
        }

        // Batch-load all participant names: 2 queries instead of 2N per page
        Set<UUID> allIds = new HashSet<>();
        for (Transaction t : transactions.getContent()) {
            if (t.getSenderId() != null) allIds.add(t.getSenderId());
            if (t.getRecipientId() != null) allIds.add(t.getRecipientId());
        }
        Map<UUID, User> userMap = userRepository.findAllById(allIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));
        Map<UUID, Merchant> merchantMap = merchantRepository.findAllById(allIds).stream()
                .collect(Collectors.toMap(Merchant::getId, m -> m));

        return transactions.map(t -> buildTransferResponse(
                t, userMap.get(t.getSenderId()), userMap.get(t.getRecipientId()), userId, merchantMap));
    }

    public TransferResponse getTransaction(UUID transactionId, UUID userId) {
        Transaction t = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new AppException("Transaction not found"));

        if (!t.getSenderId().equals(userId) && !t.getRecipientId().equals(userId)) {
            throw new AppException("Not authorized to view this transaction");
        }

        User sender = userRepository.findById(t.getSenderId()).orElse(null);
        User recipient = userRepository.findById(t.getRecipientId()).orElse(null);
        return buildTransferResponse(t, sender, recipient, userId);
    }

    //  HELPER

    private TransferResponse buildTransferResponse(Transaction t, User sender, User recipient, UUID currentUserId) {
        return buildTransferResponse(t, sender, recipient, currentUserId, null);
    }

    private TransferResponse buildTransferResponse(Transaction t, User sender, User recipient,
                                                    UUID currentUserId, Map<UUID, Merchant> preloadedMerchants) {
        String direction = t.getRecipientId().equals(currentUserId) ? "INCOMING" : "OUTGOING";

        String recipientName = "Unknown";
        if (recipient != null) {
            recipientName = recipient.getFirstName() + " " + recipient.getLastName();
        } else {
            Merchant m = preloadedMerchants != null
                    ? preloadedMerchants.get(t.getRecipientId())
                    : merchantRepository.findById(t.getRecipientId()).orElse(null);
            if (m != null) recipientName = m.getBusinessName();
        }

        String senderName = "Unknown";
        if (sender != null) {
            senderName = sender.getFirstName() + " " + sender.getLastName();
        } else {
            Merchant m = preloadedMerchants != null
                    ? preloadedMerchants.get(t.getSenderId())
                    : merchantRepository.findById(t.getSenderId()).orElse(null);
            if (m != null) senderName = m.getBusinessName();
        }

        return TransferResponse.builder()
                .id(t.getId().toString())
                .senderId(t.getSenderId().toString())
                .senderName(senderName)
                .recipientId(t.getRecipientId().toString())
                .recipientName(recipientName)
                .amount(t.getAmount())
                .currency("GHS")
                .note(t.getNote())
                .type(t.getType().name())
                .status(t.getStatus().name())
                .direction(direction)
                .initiatedAt(t.getInitiatedAt() != null ? t.getInitiatedAt().toString() : null)
                .completedAt(t.getCompletedAt() != null ? t.getCompletedAt().toString() : null)
                .category(t.getCategory() != null ? t.getCategory().name() : null)
                .build();
    }

    private void validateBalance(Wallet wallet, BigDecimal amount) {
        if (wallet.getBalance().compareTo(amount) < 0) {
            throw new AppException("INSUFFICIENT_FUNDS", "Insufficient balance", HttpStatus.BAD_REQUEST);
        }
    }

    // ==================== TASK 1: TRANSACTION SEARCH ====================

    public org.springframework.data.domain.Page<com.aza.backend.dto.admin.AdminTransactionResponse> searchTransactions(
            UUID userId,
            String status,
            String type,
            BigDecimal minAmount,
            BigDecimal maxAmount,
            LocalDateTime start,
            LocalDateTime end,
            int page,
            int size) {

        Transaction.TransactionStatus statusEnum = null;
        if (status != null && !status.isBlank()) {
            try { statusEnum = Transaction.TransactionStatus.valueOf(status.toUpperCase()); }
            catch (IllegalArgumentException e) { throw new AppException("Invalid status value"); }
        }
        Transaction.TransactionType typeEnum = null;
        if (type != null && !type.isBlank()) {
            try { typeEnum = Transaction.TransactionType.valueOf(type.toUpperCase()); }
            catch (IllegalArgumentException e) { throw new AppException("Invalid type value"); }
        }

        org.springframework.data.domain.Pageable pageable = PageRequest.of(page, Math.min(size, 100));
        org.springframework.data.domain.Page<Transaction> results = transactionRepository.searchTransactions(
                userId, statusEnum, typeEnum, minAmount, maxAmount, start, end, pageable);

        // Batch-load all participant names: 2 queries instead of 2N per page
        Set<UUID> allIds = new HashSet<>();
        for (Transaction t : results.getContent()) {
            if (t.getSenderId() != null) allIds.add(t.getSenderId());
            if (t.getRecipientId() != null) allIds.add(t.getRecipientId());
        }
        Map<UUID, User> userMap = userRepository.findAllById(allIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));
        Map<UUID, Merchant> merchantMap = merchantRepository.findAllById(allIds).stream()
                .collect(Collectors.toMap(Merchant::getId, m -> m));

        return results.map(t -> {
            User sender = userMap.get(t.getSenderId());
            User recipient = userMap.get(t.getRecipientId());
            String senderName = sender != null ? sender.getFirstName() + " " + sender.getLastName()
                    : Optional.ofNullable(merchantMap.get(t.getSenderId())).map(Merchant::getBusinessName).orElse("Unknown");
            String recipientName = recipient != null ? recipient.getFirstName() + " " + recipient.getLastName()
                    : Optional.ofNullable(merchantMap.get(t.getRecipientId())).map(Merchant::getBusinessName).orElse("Unknown");
            return com.aza.backend.dto.admin.AdminTransactionResponse.builder()
                    .id(t.getId().toString())
                    .senderId(t.getSenderId().toString())
                    .senderName(senderName)
                    .recipientId(t.getRecipientId().toString())
                    .recipientName(recipientName)
                    .amount(t.getAmount())
                    .note(t.getNote())
                    .type(t.getType().name())
                    .status(t.getStatus().name())
                    .initiatedAt(t.getInitiatedAt())
                    .completedAt(t.getCompletedAt())
                    .cancelledAt(t.getCancelledAt())
                    .category(t.getCategory() != null ? t.getCategory().name() : null)
                    .anomalyScore(t.getAnomalyScore())
                    .anomalyRiskLevel(t.getAnomalyRiskLevel())
                    .build();
        });
    }

    // ==================== TASK 2: WALLET FREEZE/UNFREEZE ====================

    @Transactional
    public java.util.Map<String, Object> freezeWallet(UUID userId) {
        Wallet wallet = walletRepository.findByUserId(userId)
                .orElseThrow(() -> new AppException("Wallet not found"));
        wallet.setFrozen(true);
        walletRepository.save(wallet);
        auditService.logWithResource(AuditLog.WALLET_FROZEN, AuditLog.SUCCESS,
                userId, null, null, wallet.getId(), "Wallet");
        return java.util.Map.of("frozen", true);
    }

    @Transactional
    public java.util.Map<String, Object> unfreezeWallet(UUID userId) {
        Wallet wallet = walletRepository.findByUserId(userId)
                .orElseThrow(() -> new AppException("Wallet not found"));
        wallet.setFrozen(false);
        walletRepository.save(wallet);
        auditService.logWithResource(AuditLog.WALLET_UNFROZEN, AuditLog.SUCCESS,
                userId, null, null, wallet.getId(), "Wallet");
        return java.util.Map.of("frozen", false);
    }

    public java.util.Map<String, Object> getWalletStatus(UUID userId) {
        Wallet wallet = walletRepository.findByUserId(userId)
                .orElseThrow(() -> new AppException("Wallet not found"));
        return java.util.Map.of(
                "frozen", Boolean.TRUE.equals(wallet.getFrozen()),
                "balance", wallet.getBalance(),
                "currency", wallet.getCurrency());
    }

    // ==================== TASK 3: SPENDING CATEGORIES ====================

    private static final java.util.Map<Transaction.TransactionCategory, String[]> CATEGORY_META;
    static {
        CATEGORY_META = new java.util.EnumMap<>(Transaction.TransactionCategory.class);
        CATEGORY_META.put(Transaction.TransactionCategory.BILLS,         new String[]{"Bills & Utilities", "#60A5FA"});
        CATEGORY_META.put(Transaction.TransactionCategory.TRANSPORT,     new String[]{"Transport",          "#34D399"});
        CATEGORY_META.put(Transaction.TransactionCategory.FOOD,          new String[]{"Food & Drinks",      "#F59E0B"});
        CATEGORY_META.put(Transaction.TransactionCategory.EDUCATION,     new String[]{"Education",          "#A78BFA"});
        CATEGORY_META.put(Transaction.TransactionCategory.ENTERTAINMENT, new String[]{"Entertainment",      "#F472B6"});
        CATEGORY_META.put(Transaction.TransactionCategory.SHOPPING,      new String[]{"Shopping",           "#FB923C"});
        CATEGORY_META.put(Transaction.TransactionCategory.HEALTHCARE,    new String[]{"Healthcare",         "#EF4444"});
        CATEGORY_META.put(Transaction.TransactionCategory.SAVINGS,       new String[]{"Savings",            "#10B981"});
        CATEGORY_META.put(Transaction.TransactionCategory.OTHERS,        new String[]{"Others",             "#94A3B8"});
    }

    public java.util.Map<String, Object> getSpendingCategories(UUID userId, LocalDateTime start, LocalDateTime end) {
        java.util.List<Transaction> debits = transactionRepository.findDebitsByUserIdAndDateRange(userId, start, end);

        java.util.Map<Transaction.TransactionCategory, BigDecimal> totals = new java.util.EnumMap<>(Transaction.TransactionCategory.class);
        java.util.Map<Transaction.TransactionCategory, Integer> counts = new java.util.EnumMap<>(Transaction.TransactionCategory.class);
        for (Transaction.TransactionCategory cat : Transaction.TransactionCategory.values()) {
            totals.put(cat, BigDecimal.ZERO);
            counts.put(cat, 0);
        }

        for (Transaction t : debits) {
            Transaction.TransactionCategory cat = t.getCategory() != null ? t.getCategory() : Transaction.TransactionCategory.OTHERS;
            totals.put(cat, totals.get(cat).add(t.getAmount()));
            counts.put(cat, counts.get(cat) + 1);
        }

        BigDecimal totalSpent = totals.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);

        java.util.List<java.util.Map<String, Object>> categories = new java.util.ArrayList<>();
        for (Transaction.TransactionCategory cat : Transaction.TransactionCategory.values()) {
            BigDecimal catTotal = totals.get(cat);
            if (catTotal.compareTo(BigDecimal.ZERO) > 0) {
                String[] meta = CATEGORY_META.get(cat);
                categories.add(java.util.Map.of(
                        "name", meta[0],
                        "key", cat.name(),
                        "total", catTotal,
                        "count", counts.get(cat),
                        "color", meta[1]));
            }
        }

        return java.util.Map.of(
                "categories", categories,
                "totalSpent", totalSpent,
                "period", java.util.Map.of("start", start.toString(), "end", end.toString()));
    }

    // ==================== FINANCIAL SUMMARY ====================

    public FinancialSummaryResponse getFinancialSummary(UUID userId, LocalDateTime start, LocalDateTime end) {
        BigDecimal totalIncome = transactionRepository.getTotalReceivedBetween(userId, start, end);
        BigDecimal totalSpent  = transactionRepository.getTotalSpentBetween(userId, start, end);
        Wallet wallet = walletRepository.findByUserId(userId)
                .orElseThrow(() -> new AppException("Wallet not found"));
        long txCount = transactionRepository.countCompletedTransactionsForUser(userId, start, end);

        return FinancialSummaryResponse.builder()
                .totalIncome(totalIncome)
                .totalSpent(totalSpent)
                .netChange(totalIncome.subtract(totalSpent))
                .balance(wallet.getBalance())
                .currency("GHS")
                .transactionCount(txCount)
                .build();
    }

    // ==================== TASK 7: USER-FACING BULK TRANSFER ====================

    /**
     * Execute a single transfer item for bulk flow. Each call runs in its own transaction
     * so a failure on one item does not roll back the others.
     */
    @Transactional
    public TransferResponse executeSingleBulkItem(User sender, String recipientIdentifier,
                                                    BigDecimal amount, String note) {
        // Resolve recipient
        String usernameCandidate = recipientIdentifier.startsWith("@")
                ? recipientIdentifier.substring(1) : recipientIdentifier;
        User recipient = userRepository
                .findByEmailOrPhoneNumber(recipientIdentifier, recipientIdentifier)
                .or(() -> userRepository.findByUsername(usernameCandidate))
                .orElse(null);

        UUID recipientId;
        if (recipient != null) {
            if (recipient.getId().equals(sender.getId()))
                throw new AppException("Cannot transfer to yourself");
            if (recipient.getStatus() != User.AccountStatus.ACTIVE)
                throw new AppException("Recipient account is not available");
            recipientId = recipient.getId();
        } else {
            Merchant merchant = merchantRepository.findByBusinessHandle(usernameCandidate)
                    .orElseThrow(() -> new AppException("Recipient not found"));
            if (merchant.getStatus() != Merchant.MerchantStatus.ACTIVE)
                throw new AppException("Recipient account is not available");
            if (merchant.getUserId().equals(sender.getId()))
                throw new AppException("Cannot transfer to yourself");
            recipientId = merchant.getId();
        }

        // Lock and debit sender
        Wallet senderWallet = walletRepository.findByUserIdForUpdate(sender.getId())
                .orElseThrow(() -> new AppException("Wallet not found"));
        if (Boolean.TRUE.equals(senderWallet.getFrozen()))
            throw new AppException("WALLET_FROZEN", "Your wallet has been frozen.", HttpStatus.FORBIDDEN);
        if (senderWallet.getBalance().compareTo(amount) < 0)
            throw new AppException("INSUFFICIENT_FUNDS", "Insufficient balance", HttpStatus.BAD_REQUEST);

        senderWallet.setBalance(senderWallet.getBalance().subtract(amount));
        walletRepository.save(senderWallet);
        sender.setBalance(senderWallet.getBalance());
        userRepository.save(sender);

        if (recipient != null) {
            Wallet recipientWallet = walletRepository.findByUserIdForUpdate(recipientId)
                    .orElseThrow(() -> new AppException("Recipient wallet not found"));
            recipientWallet.setBalance(recipientWallet.getBalance().add(amount));
            walletRepository.save(recipientWallet);
            recipient.setBalance(recipientWallet.getBalance());
            userRepository.save(recipient);
        } else {
            Merchant merchant = merchantRepository.findById(recipientId).orElseThrow();
            merchant.setBalance(merchant.getBalance().add(amount));
            merchant.setTotalVolume(merchant.getTotalVolume().add(amount));
            merchantRepository.save(merchant);
        }

        Transaction transaction = Transaction.builder()
                .senderId(sender.getId())
                .recipientId(recipientId)
                .amount(amount)
                .note(note)
                .type(Transaction.TransactionType.TRANSFER)
                .status(Transaction.TransactionStatus.COMPLETED)
                .completedAt(LocalDateTime.now())
                .build();
        transaction = transactionRepository.save(transaction);
        return buildTransferResponse(transaction, sender, recipient, sender.getId());
    }
}
