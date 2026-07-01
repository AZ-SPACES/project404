package com.aza.backend.service;

import com.aza.backend.dto.merchant.CheckoutSessionResponse;
import com.aza.backend.dto.merchant.CheckoutSplitInfo;
import com.aza.backend.dto.merchant.CheckoutSplitRequest;
import com.aza.backend.dto.merchant.ConfirmCheckoutRequest;
import com.aza.backend.dto.merchant.CreateCheckoutSessionRequest;
import com.aza.backend.entity.*;
import com.aza.backend.exception.AppException;
import com.aza.backend.entity.Transaction;
import com.aza.backend.repository.*;
import com.aza.backend.repository.MerchantNotificationPreferenceRepository;
import com.aza.backend.util.EmailService;
import com.aza.backend.util.RateLimitService;
import com.aza.backend.entity.Notification;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class CheckoutService {

    private final CheckoutSessionRepository sessionRepository;
    private final CheckoutSessionSplitRepository splitRepository;
    private final MerchantRepository merchantRepository;
    private final WalletRepository walletRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final WebhookEndpointRepository webhookEndpointRepository;
    private final WebhookDeliveryRepository webhookDeliveryRepository;
    private final UserService userService;
    private final RateLimitService rateLimitService;
    private final ObjectMapper objectMapper;
    private final EmailService emailService;
    private final MerchantNotificationPreferenceRepository notificationPrefRepository;
    private final NotificationService notificationService;

    @Value("${aza.pay.base-url:https://pay.aza.systems}")
    private String payBaseUrl;

    private static final int SESSION_TTL_MINUTES = 30;

    // ==================== CREATE SESSION ====================

    @Transactional
    public CheckoutSessionResponse createSession(UUID merchantId, CreateCheckoutSessionRequest request) {
        return createSession(merchantId, request, false);
    }

    @Transactional
    public CheckoutSessionResponse createSession(UUID merchantId, CreateCheckoutSessionRequest request, boolean testMode) {
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND));

        if (merchant.getStatus() != Merchant.MerchantStatus.ACTIVE) {
            throw new AppException("NOT_ACTIVE", "Merchant account is not active", HttpStatus.FORBIDDEN);
        }

        // Rate limit: 200 sessions per merchant per hour
        rateLimitService.enforceRateLimit("merchant:sessions:" + merchantId, 200, Duration.ofHours(1));

        // Validate metadata is valid JSON if provided
        if (request.getMetadata() != null && !request.getMetadata().isBlank()) {
            try {
                objectMapper.readTree(request.getMetadata());
            } catch (Exception e) {
                throw new AppException("INVALID_METADATA", "metadata must be valid JSON", HttpStatus.BAD_REQUEST);
            }
        }

        // Idempotency check
        if (request.getIdempotencyKey() != null && !request.getIdempotencyKey().isBlank()) {
            CheckoutSession existing = sessionRepository.findByIdempotencyKey(request.getIdempotencyKey()).orElse(null);
            if (existing != null) {
                return toResponse(existing, merchant);
            }
        }

        // Calculate tax if enabled
        BigDecimal taxAmount = null;
        String taxLabel = null;
        if (Boolean.TRUE.equals(merchant.getTaxEnabled()) && merchant.getTaxRate() != null) {
            taxAmount = request.getAmount()
                    .multiply(merchant.getTaxRate())
                    .divide(java.math.BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
            taxLabel = merchant.getTaxLabel();
        }

        CheckoutSession session = CheckoutSession.builder()
                .merchantId(merchantId)
                .amount(request.getAmount())
                .description(request.getDescription())
                .metadata(request.getMetadata())
                .reference(request.getReference())
                .successUrl(request.getSuccessUrl())
                .cancelUrl(request.getCancelUrl())
                .idempotencyKey(request.getIdempotencyKey())
                .status(CheckoutSession.SessionStatus.PENDING)
                .expiresAt(LocalDateTime.now().plusMinutes(SESSION_TTL_MINUTES))
                .taxAmount(taxAmount)
                .taxLabel(taxLabel)
                .testMode(testMode)
                .build();

        // Validate & resolve marketplace splits (Aza Connect) before persisting anything,
        // so an invalid seller fails session creation rather than a buyer's payment.
        List<CheckoutSessionSplit> splits = resolveSplits(merchant, request.getAmount(), request.getSplits());

        sessionRepository.save(session);

        if (!splits.isEmpty()) {
            for (CheckoutSessionSplit s : splits) s.setSessionId(session.getId());
            splitRepository.saveAll(splits);
        }

        log.info("Checkout session created: id={}, merchantId={}, amount={}, testMode={}, splits={}",
                session.getId(), merchantId, request.getAmount(), testMode, splits.size());
        return toResponse(session, merchant, toSplitInfos(splits));
    }

    /**
     * Validate the requested splits and resolve each seller. The Aza fee comes off the top;
     * the remainder (netAmount) is the distributable pool, so the sum of all splits must not
     * exceed it and the platform keeps whatever is left. Throws if any seller can't be paid.
     */
    private List<CheckoutSessionSplit> resolveSplits(Merchant merchant, BigDecimal amount,
                                                     List<CheckoutSplitRequest> requested) {
        if (requested == null || requested.isEmpty()) return new java.util.ArrayList<>();

        BigDecimal netAmount = amount.subtract(computeAzaFee(merchant, amount));
        BigDecimal total = BigDecimal.ZERO;
        List<CheckoutSessionSplit> resolved = new java.util.ArrayList<>();

        for (CheckoutSplitRequest req : requested) {
            if (req.getAmount() == null || req.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
                throw new AppException("INVALID_SPLIT", "Each split amount must be greater than 0", HttpStatus.BAD_REQUEST);
            }
            BigDecimal splitAmount = req.getAmount().setScale(2, RoundingMode.HALF_UP);
            total = total.add(splitAmount);

            String identifier = req.getRecipient() == null ? "" : req.getRecipient().trim();
            User seller = userRepository.findByEmailIgnoreCaseOrUsername(identifier, identifier).orElse(null);
            if (seller == null) {
                throw new AppException("SPLIT_RECIPIENT_NOT_FOUND",
                        "No Aza account matches split recipient '" + identifier + "'", HttpStatus.BAD_REQUEST);
            }
            if (seller.getId().equals(merchant.getUserId())) {
                throw new AppException("SPLIT_SELF",
                        "A split cannot pay your own account: '" + identifier + "'", HttpStatus.BAD_REQUEST);
            }
            if (seller.getStatus() != User.AccountStatus.ACTIVE) {
                throw new AppException("SPLIT_RECIPIENT_INACTIVE",
                        "Split recipient '" + identifier + "' is not active", HttpStatus.BAD_REQUEST);
            }
            if (walletRepository.findByUserId(seller.getId()).isEmpty()) {
                throw new AppException("SPLIT_RECIPIENT_NO_WALLET",
                        "Split recipient '" + identifier + "' has no wallet", HttpStatus.BAD_REQUEST);
            }

            resolved.add(CheckoutSessionSplit.builder()
                    .recipientUserId(seller.getId())
                    .recipientIdentifier(identifier)
                    .amount(splitAmount)
                    .note(req.getNote())
                    .status(CheckoutSessionSplit.Status.PENDING)
                    .build());
        }

        if (total.compareTo(netAmount) > 0) {
            throw new AppException("SPLITS_EXCEED_NET",
                    "Splits total " + merchant.getCurrency() + " " + total + " but only "
                            + merchant.getCurrency() + " " + netAmount
                            + " is available after the Aza fee. Reduce the splits or raise the amount.",
                    HttpStatus.BAD_REQUEST);
        }
        return resolved;
    }

    /**
     * Credit each seller's split to their wallet, capped at the remaining distributable
     * budget. A split that can't be paid (seller gone/inactive/frozen, or budget exhausted
     * because the fee changed since creation) is marked FALLBACK_TO_PLATFORM and its amount
     * stays with the platform. Returns the (mutated, saved) split rows.
     */
    private List<CheckoutSessionSplit> creditSplits(CheckoutSession session, Merchant merchant, BigDecimal netAmount) {
        List<CheckoutSessionSplit> splits = splitRepository.findAllBySessionId(session.getId());
        if (splits.isEmpty()) return splits;

        BigDecimal budgetLeft = netAmount;
        for (CheckoutSessionSplit split : splits) {
            User seller = split.getRecipientUserId() != null
                    ? userRepository.findById(split.getRecipientUserId()).orElse(null) : null;
            Wallet wallet = seller != null ? walletRepository.findByUserId(seller.getId()).orElse(null) : null;

            String reason = null;
            if (seller == null) reason = "Recipient not found";
            else if (seller.getStatus() != User.AccountStatus.ACTIVE) reason = "Recipient not active";
            else if (wallet == null) reason = "Recipient wallet not found";
            else if (Boolean.TRUE.equals(wallet.getFrozen())) reason = "Recipient wallet frozen";
            else if (split.getAmount().compareTo(budgetLeft) > 0) reason = "Insufficient remaining amount for split";

            if (reason != null) {
                split.setStatus(CheckoutSessionSplit.Status.FALLBACK_TO_PLATFORM);
                split.setFailureReason(reason);
                split.setProcessedAt(LocalDateTime.now());
                continue;
            }

            wallet.setBalance(wallet.getBalance().add(split.getAmount()));
            walletRepository.save(wallet);
            seller.setBalance(wallet.getBalance());
            userRepository.save(seller);
            budgetLeft = budgetLeft.subtract(split.getAmount());

            String note = (split.getNote() != null && !split.getNote().isBlank())
                    ? split.getNote()
                    : "Sale via " + merchant.getBusinessName();
            Transaction tx = Transaction.builder()
                    .senderId(merchant.getUserId())
                    .recipientId(seller.getId())
                    .amount(split.getAmount())
                    .note(note)
                    .type(Transaction.TransactionType.TRANSFER)
                    .status(Transaction.TransactionStatus.COMPLETED)
                    .idempotencyKey("checkout-split:" + split.getId())
                    .completedAt(LocalDateTime.now())
                    .build();
            transactionRepository.save(tx);

            split.setStatus(CheckoutSessionSplit.Status.CREDITED);
            split.setTransactionId(tx.getId());
            split.setProcessedAt(LocalDateTime.now());

            notificationService.sendNotification(
                    seller.getId(),
                    Notification.NotificationType.MONEY_RECEIVED,
                    "Money Received",
                    merchant.getBusinessName() + " sent you " + merchant.getCurrency() + " " + split.getAmount(),
                    null);
        }
        splitRepository.saveAll(splits);
        return splits;
    }

    private BigDecimal computeAzaFee(Merchant merchant, BigDecimal amount) {
        BigDecimal feeRate = BigDecimal.valueOf(merchant.getFeeRateBps())
                .divide(BigDecimal.valueOf(10_000), 6, RoundingMode.HALF_UP);
        return amount.multiply(feeRate).setScale(2, RoundingMode.HALF_UP);
    }

    private List<CheckoutSplitInfo> toSplitInfos(List<CheckoutSessionSplit> splits) {
        if (splits == null || splits.isEmpty()) return null;
        return splits.stream().map(s -> CheckoutSplitInfo.builder()
                .recipient(s.getRecipientIdentifier())
                .amount(s.getAmount())
                .status(s.getStatus().name())
                .failureReason(s.getFailureReason())
                .build()).collect(java.util.stream.Collectors.toList());
    }

    // ==================== GET SESSION (public) ====================

    public CheckoutSessionResponse getSession(UUID sessionId) {
        CheckoutSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Checkout session not found", HttpStatus.NOT_FOUND));
        Merchant merchant = merchantRepository.findById(session.getMerchantId())
                .orElseThrow(() -> new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND));

        if (session.getStatus() == CheckoutSession.SessionStatus.PENDING
                && session.getExpiresAt() != null
                && LocalDateTime.now().isAfter(session.getExpiresAt())) {
            session.setStatus(CheckoutSession.SessionStatus.EXPIRED);
            sessionRepository.save(session);
        }

        // Public response: strip customerId to protect payer privacy
        return toPublicResponse(session, merchant);
    }

    // ==================== CONFIRM PAYMENT ====================

    @Transactional
    public CheckoutSessionResponse confirmPayment(UUID sessionId, UUID customerId, ConfirmCheckoutRequest request) {
        CheckoutSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Checkout session not found", HttpStatus.NOT_FOUND));

        if (session.getStatus() != CheckoutSession.SessionStatus.PENDING) {
            throw new AppException("SESSION_NOT_PENDING",
                    "Session is " + session.getStatus().name().toLowerCase() + " and cannot be paid",
                    HttpStatus.BAD_REQUEST);
        }

        if (session.getExpiresAt() != null && LocalDateTime.now().isAfter(session.getExpiresAt())) {
            session.setStatus(CheckoutSession.SessionStatus.EXPIRED);
            sessionRepository.save(session);
            throw new AppException("SESSION_EXPIRED", "This payment link has expired", HttpStatus.BAD_REQUEST);
        }

        // Sandbox: a test-mode link completes without charging anyone — no passcode,
        // no wallet debit, no merchant credit. Lets devs exercise the full flow safely.
        if (Boolean.TRUE.equals(session.getTestMode())) {
            Merchant testMerchant = merchantRepository.findById(session.getMerchantId())
                    .orElseThrow(() -> new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND));
            return completeTestSession(session, testMerchant, customerId);
        }

        // Verify passcode before acquiring locks — avoids holding DB locks during a Redis round-trip
        User customer = userService.findById(customerId);
        userService.verifyPasscode(customer, request.getPasscode());

        if (customer.getStatus() != User.AccountStatus.ACTIVE) {
            throw new AppException("ACCOUNT_INACTIVE", "Your account is not active", HttpStatus.BAD_REQUEST);
        }
        if (customer.getKycStatus() != User.KycStatus.VERIFIED) {
            throw new AppException("KYC_REQUIRED", "KYC verification required to make payments", HttpStatus.BAD_REQUEST);
        }

        // Pessimistic lock on merchant prevents concurrent payments from producing a lost update
        Merchant merchant = merchantRepository.findByIdForUpdate(session.getMerchantId())
                .orElseThrow(() -> new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND));

        if (merchant.getStatus() != Merchant.MerchantStatus.ACTIVE) {
            throw new AppException("MERCHANT_INACTIVE", "Merchant is not accepting payments", HttpStatus.BAD_REQUEST);
        }

        if (merchant.getUserId().equals(customerId)) {
            throw new AppException("SELF_PAYMENT", "You cannot pay your own merchant account", HttpStatus.BAD_REQUEST);
        }

        // Pessimistic lock on the customer wallet — must come after merchant lock to maintain consistent lock ordering
        Wallet customerWallet = walletRepository.findByUserIdForUpdate(customerId)
                .orElseThrow(() -> new AppException("NO_WALLET", "Wallet not found", HttpStatus.NOT_FOUND));

        if (Boolean.TRUE.equals(customerWallet.getFrozen())) {
            throw new AppException("WALLET_FROZEN", "Your wallet has been frozen. Please contact support.", HttpStatus.FORBIDDEN);
        }

        if (customerWallet.getBalance().compareTo(session.getAmount()) < 0) {
            throw new AppException("INSUFFICIENT_FUNDS", "Insufficient balance", HttpStatus.BAD_REQUEST);
        }

        // Calculate fee
        BigDecimal feeRate = BigDecimal.valueOf(merchant.getFeeRateBps()).divide(BigDecimal.valueOf(10_000), 6, RoundingMode.HALF_UP);
        BigDecimal platformFee = session.getAmount().multiply(feeRate).setScale(2, RoundingMode.HALF_UP);
        BigDecimal netAmount = session.getAmount().subtract(platformFee);

        // Debit customer
        customerWallet.setBalance(customerWallet.getBalance().subtract(session.getAmount()));
        walletRepository.save(customerWallet);
        customer.setBalance(customerWallet.getBalance());
        userRepository.save(customer);

        // Route marketplace splits straight to the sellers' wallets; the platform keeps
        // whatever is left of netAmount. Splits that can't be paid fall back to the platform
        // so the buyer's payment is never blocked by an unpayable seller.
        List<CheckoutSessionSplit> splits = creditSplits(session, merchant, netAmount);
        BigDecimal creditedToSellers = splits.stream()
                .filter(sp -> sp.getStatus() == CheckoutSessionSplit.Status.CREDITED)
                .map(CheckoutSessionSplit::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal platformCredit = netAmount.subtract(creditedToSellers);

        // Credit platform merchant its share (net of fee and seller splits)
        merchant.setBalance(merchant.getBalance().add(platformCredit));
        merchant.setTotalVolume(merchant.getTotalVolume().add(session.getAmount()));
        merchantRepository.save(merchant);

        // Write a transaction record so the payment appears in both parties' history
        String note = session.getDescription() != null && !session.getDescription().isBlank()
                ? session.getDescription()
                : "Payment to @" + merchant.getBusinessHandle();
        Transaction tx = Transaction.builder()
                .senderId(customerId)
                .recipientId(merchant.getUserId())
                .amount(session.getAmount())
                .feeAmount(platformFee)   // reporting only — balances are set above; lets merchant fees show in fee analytics
                .note(note)
                .type(Transaction.TransactionType.TRANSFER)
                .status(Transaction.TransactionStatus.COMPLETED)
                .idempotencyKey("checkout:" + session.getId())
                .completedAt(LocalDateTime.now())
                .build();
        transactionRepository.save(tx);

        // Complete session
        session.setStatus(CheckoutSession.SessionStatus.COMPLETED);
        session.setCustomerId(customerId);
        session.setPlatformFee(platformFee);
        session.setNetAmount(platformCredit);
        session.setCompletedAt(LocalDateTime.now());
        session.setTransactionId(tx.getId());
        sessionRepository.save(session);

        log.info("Checkout confirmed: sessionId={}, customer={}, merchant={}, amount={}, sellerSplits={}",
                sessionId, customerId, merchant.getId(), session.getAmount(), creditedToSellers);

        // Dispatch webhooks asynchronously
        scheduleWebhookDelivery(session, merchant);

        String senderName = customer.getFirstName() + " " + customer.getLastName();
        String ref = "CHK-" + sessionId.toString().substring(28).toUpperCase();

        // Push notification to merchant owner (always fire — fast, no opt-out needed)
        notificationService.sendNotification(
                merchant.getUserId(),
                Notification.NotificationType.MONEY_RECEIVED,
                "Payment Received",
                senderName + " paid " + merchant.getCurrency() + " " + session.getAmount() + " via " + merchant.getBusinessName(),
                null);

        boolean sendInvoiceEmail = notificationPrefRepository.findByMerchantId(merchant.getId())
                .map(com.aza.backend.entity.MerchantNotificationPreference::isEmailInvoicePaid)
                .orElse(true);
        if (sendInvoiceEmail) {
            userRepository.findById(merchant.getUserId()).ifPresent(owner ->
                    emailService.sendMerchantPaymentReceivedEmail(
                            owner.getEmail(), owner.getFirstName(),
                            merchant.getBusinessName(), session.getAmount(), senderName, ref));
        }

        return toResponse(session, merchant, toSplitInfos(splits));
    }

    // ==================== CANCEL SESSION ====================

    @Transactional
    public CheckoutSessionResponse cancelSession(UUID sessionId, UUID requesterId) {
        CheckoutSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Checkout session not found", HttpStatus.NOT_FOUND));

        // Only the merchant who owns this session may cancel it
        Merchant merchant = merchantRepository.findByUserId(requesterId).orElse(null);
        if (merchant == null || !merchant.getId().equals(session.getMerchantId())) {
            throw new AppException("FORBIDDEN", "Only the merchant can cancel this session", HttpStatus.FORBIDDEN);
        }

        if (session.getStatus() != CheckoutSession.SessionStatus.PENDING) {
            throw new AppException("CANNOT_CANCEL",
                    "Only pending sessions can be cancelled", HttpStatus.BAD_REQUEST);
        }

        session.setStatus(CheckoutSession.SessionStatus.CANCELLED);
        session.setCancelledAt(LocalDateTime.now());
        sessionRepository.save(session);

        return toResponse(session, merchant);
    }

    // ==================== MERCHANT-SCOPED SESSION GET ====================

    public CheckoutSessionResponse getMerchantSession(UUID sessionId, UUID merchantId) {
        CheckoutSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Session not found", HttpStatus.NOT_FOUND));
        if (!session.getMerchantId().equals(merchantId)) {
            throw new AppException("FORBIDDEN", "This session does not belong to your merchant account", HttpStatus.FORBIDDEN);
        }
        Merchant merchant = merchantRepository.findById(session.getMerchantId())
                .orElseThrow(() -> new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND));
        return toResponse(session, merchant);
    }

    // ==================== LIST SESSIONS (merchant) ====================

    public Page<CheckoutSessionResponse> listMerchantSessions(UUID merchantId, int page, int size) {
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND));
        return sessionRepository.findAllByMerchantIdOrderByCreatedAtDesc(
                        merchantId, PageRequest.of(page, Math.min(size, 50)))
                .map(s -> toResponse(s, merchant));
    }

    public Page<CheckoutSessionResponse> searchMerchantSessions(
            UUID merchantId, int page, int size,
            String status, String from, String to, String q, Boolean testMode, String reference) {
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND));

        CheckoutSession.SessionStatus statusEnum = null;
        if (status != null && !status.isBlank()) {
            try { statusEnum = CheckoutSession.SessionStatus.valueOf(status.toUpperCase()); } catch (Exception ignored) {}
        }
        LocalDateTime fromDt = null;
        LocalDateTime toDt = null;
        if (from != null && !from.isBlank()) {
            try { fromDt = LocalDateTime.parse(from + "T00:00:00"); } catch (Exception ignored) {}
        }
        if (to != null && !to.isBlank()) {
            try { toDt = LocalDateTime.parse(to + "T23:59:59"); } catch (Exception ignored) {}
        }
        String qParam = (q != null && !q.isBlank()) ? q.trim() : null;
        String referenceParam = (reference != null && !reference.isBlank()) ? reference.trim() : null;

        return sessionRepository.searchSessions(
                        merchantId, statusEnum, fromDt, toDt, testMode, referenceParam, qParam,
                        PageRequest.of(page, Math.min(size, 50)))
                .map(s -> toResponse(s, merchant));
    }

    /**
     * Per-reference reconciliation summary for a platform merchant: count + gross + net of its
     * COMPLETED sessions carrying a given reference (e.g. one tenant/seller or order group).
     */
    public Map<String, Object> reconcileByReference(UUID merchantId, String reference) {
        if (reference == null || reference.isBlank()) {
            throw new AppException("VALIDATION", "reference is required", HttpStatus.BAD_REQUEST);
        }
        String ref = reference.trim();
        List<Object[]> rows = sessionRepository.reconcileByReference(merchantId, ref);
        Object[] row = rows.isEmpty() ? new Object[]{0L, BigDecimal.ZERO, BigDecimal.ZERO} : rows.get(0);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("reference", ref);
        result.put("completedCount", row[0] != null ? ((Number) row[0]).longValue() : 0L);
        result.put("totalAmount", row[1] != null ? row[1] : BigDecimal.ZERO);
        result.put("totalNetAmount", row[2] != null ? row[2] : BigDecimal.ZERO);
        return result;
    }

    public Page<CheckoutSessionResponse> listCustomerSessions(
            UUID merchantId, UUID customerId, int page, int size) {
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND));
        return sessionRepository.findAllByMerchantIdAndCustomerIdOrderByCreatedAtDesc(
                        merchantId, customerId, PageRequest.of(page, Math.min(size, 50)))
                .map(s -> toResponse(s, merchant));
    }

    // ==================== SCHEDULED EXPIRY ====================

    @Scheduled(fixedDelay = 60_000) // every 60 seconds
    @Transactional
    public void expireSessions() {
        List<CheckoutSession> expired = sessionRepository.findExpiredSessions(LocalDateTime.now());
        if (expired.isEmpty()) return;
        for (CheckoutSession session : expired) {
            session.setStatus(CheckoutSession.SessionStatus.EXPIRED);
        }
        sessionRepository.saveAll(expired);
        log.info("Expired {} checkout sessions", expired.size());
    }

    // ==================== WEBHOOK DISPATCH ====================

    public void scheduleWebhookDelivery(CheckoutSession session, Merchant merchant) {
        List<WebhookEndpoint> endpoints = webhookEndpointRepository
                .findAllByMerchantIdAndIsActiveTrue(merchant.getId());
        if (endpoints.isEmpty()) return;

        String payload = buildWebhookPayload(session, merchant);

        for (WebhookEndpoint endpoint : endpoints) {
            if (!isSubscribed(endpoint)) continue;
            WebhookDelivery delivery = WebhookDelivery.builder()
                    .endpointId(endpoint.getId())
                    .checkoutSessionId(session.getId())
                    .eventType("checkout.completed")
                    .payload(payload)
                    .status(WebhookDelivery.DeliveryStatus.PENDING)
                    .nextRetryAt(LocalDateTime.now())
                    .build();
            webhookDeliveryRepository.save(delivery);
        }
    }

    private boolean isSubscribed(WebhookEndpoint endpoint) {
        if (endpoint.getEvents() == null) return false;
        for (String e : endpoint.getEvents().split(",")) {
            if (e.trim().equalsIgnoreCase("checkout.completed") || e.trim().equals("*")) return true;
        }
        return false;
    }

    private String buildWebhookPayload(CheckoutSession session, Merchant merchant) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("event", "checkout.completed");
            payload.put("livemode", !Boolean.TRUE.equals(session.getTestMode()));
            payload.put("sessionId", session.getId().toString());
            payload.put("merchantId", merchant.getId().toString());
            payload.put("amount", session.getAmount());
            payload.put("currency", session.getCurrency());
            payload.put("platformFee", session.getPlatformFee());
            payload.put("netAmount", session.getNetAmount());
            // Attribution data so a platform merchant can route the payment to the right
            // tenant/order from the webhook alone, without a follow-up GET /sessions/{id}.
            payload.put("reference", session.getReference());
            payload.put("description", session.getDescription());
            payload.put("metadata", session.getMetadata());
            // Per-seller settlement so a marketplace can reconcile each seller from the
            // webhook alone. netAmount above is what the platform kept after fee + splits.
            List<CheckoutSessionSplit> splits = splitRepository.findAllBySessionId(session.getId());
            if (!splits.isEmpty()) {
                List<Map<String, Object>> splitList = new java.util.ArrayList<>();
                for (CheckoutSessionSplit sp : splits) {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("recipient", sp.getRecipientIdentifier());
                    m.put("amount", sp.getAmount());
                    m.put("status", sp.getStatus().name());
                    splitList.add(m);
                }
                payload.put("splits", splitList);
            }
            payload.put("completedAt", session.getCompletedAt().toString());
            return objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            log.error("Failed to serialize webhook payload for session {}", session.getId(), e);
            throw new AppException("Failed to build webhook payload", e);
        }
    }

    // ==================== HELPERS ====================

    // ==================== EXPIRE SESSION (merchant-initiated) ====================

    @Transactional
    public CheckoutSessionResponse expireSession(UUID sessionId, UUID userId) {
        CheckoutSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Checkout session not found", HttpStatus.NOT_FOUND));
        Merchant merchant = merchantRepository.findByUserId(userId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND));
        if (!session.getMerchantId().equals(merchant.getId())) {
            throw new AppException("FORBIDDEN", "Not your session", HttpStatus.FORBIDDEN);
        }
        if (session.getStatus() != CheckoutSession.SessionStatus.PENDING) {
            throw new AppException("CANNOT_EXPIRE", "Only pending sessions can be expired", HttpStatus.BAD_REQUEST);
        }
        session.setStatus(CheckoutSession.SessionStatus.EXPIRED);
        sessionRepository.save(session);
        return toResponse(session, merchant);
    }

    // ==================== SANDBOX (TEST MODE) ====================

    /**
     * Sandbox completion — marks a test session COMPLETED and fires test webhooks
     * WITHOUT moving any funds. No wallet debit, no merchant credit, no Transaction,
     * no effect on balances/volume/settlement. {@code customerId} may be null.
     */
    private CheckoutSessionResponse completeTestSession(CheckoutSession session, Merchant merchant, UUID customerId) {
        BigDecimal feeRate = BigDecimal.valueOf(merchant.getFeeRateBps()).divide(BigDecimal.valueOf(10_000), 6, RoundingMode.HALF_UP);
        BigDecimal platformFee = session.getAmount().multiply(feeRate).setScale(2, RoundingMode.HALF_UP);
        BigDecimal netAmount = session.getAmount().subtract(platformFee);

        // Preview splits without moving money: netAmount shows what the platform would keep.
        List<CheckoutSessionSplit> splits = splitRepository.findAllBySessionId(session.getId());
        BigDecimal splitTotal = splits.stream()
                .map(CheckoutSessionSplit::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        session.setStatus(CheckoutSession.SessionStatus.COMPLETED);
        session.setCustomerId(customerId);
        session.setPlatformFee(platformFee);
        session.setNetAmount(netAmount.subtract(splitTotal));
        session.setCompletedAt(LocalDateTime.now());
        // transactionId intentionally left null — no real money moved.
        sessionRepository.save(session);

        log.info("TEST checkout completed (no funds moved): sessionId={}, merchant={}, amount={}, splits={}",
                session.getId(), merchant.getId(), session.getAmount(), splits.size());

        scheduleWebhookDelivery(session, merchant);
        return toResponse(session, merchant, toSplitInfos(splits));
    }

    /**
     * Simulate payment of a test session — the sandbox's primary tool. Lets a developer
     * complete a test checkout end-to-end (and trigger webhooks) without a real customer.
     * Rejects live sessions so it can never complete a real payment for free.
     */
    @Transactional
    public CheckoutSessionResponse simulatePayment(UUID sessionId, UUID merchantId) {
        CheckoutSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Checkout session not found", HttpStatus.NOT_FOUND));

        if (!session.getMerchantId().equals(merchantId)) {
            throw new AppException("FORBIDDEN", "Not your session", HttpStatus.FORBIDDEN);
        }
        if (!Boolean.TRUE.equals(session.getTestMode())) {
            throw new AppException("NOT_TEST_SESSION",
                    "Only test-mode sessions can be simulated. Create the session with an aza_test_ key.",
                    HttpStatus.BAD_REQUEST);
        }
        if (session.getStatus() != CheckoutSession.SessionStatus.PENDING) {
            throw new AppException("SESSION_NOT_PENDING",
                    "Session is " + session.getStatus().name().toLowerCase() + " and cannot be paid",
                    HttpStatus.BAD_REQUEST);
        }
        if (session.getExpiresAt() != null && LocalDateTime.now().isAfter(session.getExpiresAt())) {
            session.setStatus(CheckoutSession.SessionStatus.EXPIRED);
            sessionRepository.save(session);
            throw new AppException("SESSION_EXPIRED", "This test session has expired", HttpStatus.BAD_REQUEST);
        }

        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND));
        return completeTestSession(session, merchant, null);
    }

    // ==================== HELPERS ====================

    /** Public-facing response: omits customerId to protect payer privacy. */
    private CheckoutSessionResponse toPublicResponse(CheckoutSession s, Merchant merchant) {
        return CheckoutSessionResponse.builder()
                .id(s.getId().toString())
                .merchantId(s.getMerchantId().toString())
                .merchantName(merchant != null ? merchant.getBusinessName() : null)
                .merchantHandle(merchant != null ? merchant.getBusinessHandle() : null)
                .merchantLogoUrl(merchant != null ? merchant.getLogoUrl() : null)
                .merchantBrandColor(merchant != null ? merchant.getBrandColor() : null)
                .merchantCheckoutTagline(merchant != null ? merchant.getCheckoutTagline() : null)
                .merchantSupportEmail(merchant != null ? merchant.getSupportEmail() : null)
                .amount(s.getAmount())
                .currency(s.getCurrency())
                .description(s.getDescription())
                .taxAmount(s.getTaxAmount())
                .taxLabel(s.getTaxLabel())
                .status(s.getStatus().name())
                .testMode(Boolean.TRUE.equals(s.getTestMode()))
                .checkoutUrl(payBaseUrl + "/c/" + s.getId())
                .createdAt(s.getCreatedAt())
                .expiresAt(s.getExpiresAt())
                .build();
    }

    private CheckoutSessionResponse toResponse(CheckoutSession s, Merchant merchant) {
        return toResponse(s, merchant, null);
    }

    private CheckoutSessionResponse toResponse(CheckoutSession s, Merchant merchant, List<CheckoutSplitInfo> splits) {
        return CheckoutSessionResponse.builder()
                .id(s.getId().toString())
                .merchantId(s.getMerchantId().toString())
                .merchantName(merchant != null ? merchant.getBusinessName() : null)
                .merchantHandle(merchant != null ? merchant.getBusinessHandle() : null)
                .merchantLogoUrl(merchant != null ? merchant.getLogoUrl() : null)
                .merchantBrandColor(merchant != null ? merchant.getBrandColor() : null)
                .merchantCheckoutTagline(merchant != null ? merchant.getCheckoutTagline() : null)
                .merchantSupportEmail(merchant != null ? merchant.getSupportEmail() : null)
                .amount(s.getAmount())
                .currency(s.getCurrency())
                .description(s.getDescription())
                .metadata(s.getMetadata())
                .reference(s.getReference())
                .successUrl(s.getSuccessUrl())
                .cancelUrl(s.getCancelUrl())
                .status(s.getStatus().name())
                .customerId(s.getCustomerId() != null ? s.getCustomerId().toString() : null)
                .platformFee(s.getPlatformFee())
                .netAmount(s.getNetAmount())
                .splits(splits)
                .taxAmount(s.getTaxAmount())
                .taxLabel(s.getTaxLabel())
                .testMode(Boolean.TRUE.equals(s.getTestMode()))
                .checkoutUrl(payBaseUrl + "/c/" + s.getId())
                .createdAt(s.getCreatedAt())
                .expiresAt(s.getExpiresAt())
                .completedAt(s.getCompletedAt())
                .cancelledAt(s.getCancelledAt())
                .refundedAt(s.getRefundedAt())
                .build();
    }

    // ==================== REFUND SESSION ====================

    @Transactional
    public CheckoutSessionResponse refundSession(UUID merchantId, UUID sessionId) {
        CheckoutSession session = sessionRepository.findByIdAndMerchantId(sessionId, merchantId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Session not found", HttpStatus.NOT_FOUND));

        if (session.getStatus() != CheckoutSession.SessionStatus.COMPLETED) {
            throw new AppException("INVALID_STATUS", "Only completed sessions can be refunded", HttpStatus.BAD_REQUEST);
        }

        User customer = userRepository.findById(session.getCustomerId())
                .orElseThrow(() -> new AppException("NOT_FOUND", "Customer not found", HttpStatus.NOT_FOUND));

        // Merchant lock first (serialises this platform's money movements), then wallets.
        Merchant merchant = merchantRepository.findByIdForUpdate(merchantId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND));

        BigDecimal refundAmount = session.getAmount();
        List<CheckoutSessionSplit> splits = splitRepository.findAllBySessionId(sessionId);
        List<CheckoutSessionSplit> credited = splits.stream()
                .filter(s -> s.getStatus() == CheckoutSessionSplit.Status.CREDITED)
                .collect(java.util.stream.Collectors.toList());

        // How much the sellers must give back, and therefore how much the platform must cover
        // (its own kept share + the Aza fee it absorbs on a refund).
        BigDecimal sellersTotal = credited.stream()
                .map(CheckoutSessionSplit::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal platformPortion = refundAmount.subtract(sellersTotal);

        if (merchant.getBalance().compareTo(platformPortion) < 0) {
            throw new AppException("INSUFFICIENT_FUNDS",
                    "Your balance is insufficient to cover your share of this refund ("
                            + merchant.getCurrency() + " " + platformPortion + ")", HttpStatus.BAD_REQUEST);
        }

        // Lock each seller's wallet (sorted by user id for deadlock safety) and verify each
        // seller can give back their share before moving any money.
        java.util.Map<UUID, Wallet> sellerWallets = new LinkedHashMap<>();
        java.util.Map<UUID, BigDecimal> requiredPerSeller = new LinkedHashMap<>();
        for (CheckoutSessionSplit split : credited) {
            requiredPerSeller.merge(split.getRecipientUserId(), split.getAmount(), BigDecimal::add);
        }
        requiredPerSeller.keySet().stream().sorted().forEach(uid -> {
            Wallet w = walletRepository.findByUserIdForUpdate(uid)
                    .orElseThrow(() -> new AppException("SELLER_CLAWBACK_FAILED",
                            "A seller's wallet could not be found to reverse their share", HttpStatus.BAD_REQUEST));
            if (Boolean.TRUE.equals(w.getFrozen())) {
                throw new AppException("SELLER_CLAWBACK_FROZEN",
                        "Seller wallet is frozen; reverse their share manually", HttpStatus.BAD_REQUEST);
            }
            if (w.getBalance().compareTo(requiredPerSeller.get(uid)) < 0) {
                throw new AppException("SELLER_CLAWBACK_INSUFFICIENT",
                        "A seller has already spent their share and cannot be auto-refunded ("
                                + merchant.getCurrency() + " " + requiredPerSeller.get(uid)
                                + " needed). Reverse it manually.", HttpStatus.BAD_REQUEST);
            }
            sellerWallets.put(uid, w);
        });

        Wallet customerWallet = walletRepository.findByUserIdForUpdate(session.getCustomerId())
                .orElseThrow(() -> new AppException("NOT_FOUND", "Customer wallet not found", HttpStatus.NOT_FOUND));

        String baseNote = session.getDescription() != null ? session.getDescription() : "Payment refund";

        // 1. Platform gives back its portion (kept share + absorbed fee).
        merchant.setBalance(merchant.getBalance().subtract(platformPortion));
        merchantRepository.save(merchant);
        transactionRepository.save(Transaction.builder()
                .senderId(merchant.getUserId())
                .recipientId(session.getCustomerId())
                .amount(platformPortion)
                .note("Refund: " + baseNote)
                .type(Transaction.TransactionType.TRANSFER)
                .status(Transaction.TransactionStatus.COMPLETED)
                .idempotencyKey("refund:" + session.getId())
                .completedAt(LocalDateTime.now())
                .build());

        // 2. Each seller gives back their share.
        for (CheckoutSessionSplit split : credited) {
            Wallet w = sellerWallets.get(split.getRecipientUserId());
            w.setBalance(w.getBalance().subtract(split.getAmount()));
            walletRepository.save(w);
            userRepository.findById(split.getRecipientUserId()).ifPresent(seller -> {
                seller.setBalance(w.getBalance());
                userRepository.save(seller);
            });
            transactionRepository.save(Transaction.builder()
                    .senderId(split.getRecipientUserId())
                    .recipientId(session.getCustomerId())
                    .amount(split.getAmount())
                    .note("Refund (seller share): " + baseNote)
                    .type(Transaction.TransactionType.TRANSFER)
                    .status(Transaction.TransactionStatus.COMPLETED)
                    .idempotencyKey("refund-split:" + split.getId())
                    .completedAt(LocalDateTime.now())
                    .build());
            split.setStatus(CheckoutSessionSplit.Status.REVERSED);
            split.setProcessedAt(LocalDateTime.now());
        }
        if (!credited.isEmpty()) splitRepository.saveAll(credited);

        // 3. Customer receives the full original amount.
        customerWallet.setBalance(customerWallet.getBalance().add(refundAmount));
        walletRepository.save(customerWallet);
        customer.setBalance(customerWallet.getBalance());
        userRepository.save(customer);

        session.setStatus(CheckoutSession.SessionStatus.REFUNDED);
        session.setRefundedAt(LocalDateTime.now());
        sessionRepository.save(session);

        log.info("Session refunded: sessionId={}, merchantId={}, amount={}, sellersClawedBack={}",
                sessionId, merchantId, refundAmount, sellersTotal);
        return toResponse(session, merchant, toSplitInfos(splits));
    }
}
