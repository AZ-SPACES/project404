package com.aza.backend.service;

import com.aza.backend.dto.merchant.CheckoutSessionResponse;
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
                .successUrl(request.getSuccessUrl())
                .cancelUrl(request.getCancelUrl())
                .idempotencyKey(request.getIdempotencyKey())
                .status(CheckoutSession.SessionStatus.PENDING)
                .expiresAt(LocalDateTime.now().plusMinutes(SESSION_TTL_MINUTES))
                .taxAmount(taxAmount)
                .taxLabel(taxLabel)
                .testMode(testMode)
                .build();

        sessionRepository.save(session);
        log.info("Checkout session created: id={}, merchantId={}, amount={}, testMode={}",
                session.getId(), merchantId, request.getAmount(), testMode);
        return toResponse(session, merchant);
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

        // Credit merchant (net of fee)
        merchant.setBalance(merchant.getBalance().add(netAmount));
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
        session.setNetAmount(netAmount);
        session.setCompletedAt(LocalDateTime.now());
        session.setTransactionId(tx.getId());
        sessionRepository.save(session);

        log.info("Checkout confirmed: sessionId={}, customer={}, merchant={}, amount={}", sessionId, customerId, merchant.getId(), session.getAmount());

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

        return toResponse(session, merchant);
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
            String status, String from, String to, String q, Boolean testMode) {
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

        return sessionRepository.searchSessions(
                        merchantId, statusEnum, fromDt, toDt, testMode, qParam,
                        PageRequest.of(page, Math.min(size, 50)))
                .map(s -> toResponse(s, merchant));
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

        session.setStatus(CheckoutSession.SessionStatus.COMPLETED);
        session.setCustomerId(customerId);
        session.setPlatformFee(platformFee);
        session.setNetAmount(netAmount);
        session.setCompletedAt(LocalDateTime.now());
        // transactionId intentionally left null — no real money moved.
        sessionRepository.save(session);

        log.info("TEST checkout completed (no funds moved): sessionId={}, merchant={}, amount={}",
                session.getId(), merchant.getId(), session.getAmount());

        scheduleWebhookDelivery(session, merchant);
        return toResponse(session, merchant);
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
                .successUrl(s.getSuccessUrl())
                .cancelUrl(s.getCancelUrl())
                .status(s.getStatus().name())
                .customerId(s.getCustomerId() != null ? s.getCustomerId().toString() : null)
                .platformFee(s.getPlatformFee())
                .netAmount(s.getNetAmount())
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

        Wallet customerWallet = walletRepository.findByUserIdForUpdate(session.getCustomerId())
                .orElseThrow(() -> new AppException("NOT_FOUND", "Customer wallet not found", HttpStatus.NOT_FOUND));

        Merchant merchant = merchantRepository.findByIdForUpdate(merchantId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND));

        BigDecimal refundAmount = session.getAmount();
        if (merchant.getBalance().compareTo(refundAmount) < 0) {
            throw new AppException("INSUFFICIENT_FUNDS",
                    "Merchant balance is insufficient to process this refund", HttpStatus.BAD_REQUEST);
        }

        // Debit merchant full original amount (merchant absorbs the platform fee on refunds)
        merchant.setBalance(merchant.getBalance().subtract(refundAmount));
        merchantRepository.save(merchant);

        // Credit customer the full original amount they paid
        customerWallet.setBalance(customerWallet.getBalance().add(refundAmount));
        walletRepository.save(customerWallet);
        customer.setBalance(customerWallet.getBalance());
        userRepository.save(customer);

        // Create reversal transaction
        String note = "Refund: " + (session.getDescription() != null ? session.getDescription() : "Payment refund");
        Transaction tx = Transaction.builder()
                .senderId(merchant.getUserId())
                .recipientId(session.getCustomerId())
                .amount(refundAmount)
                .note(note)
                .type(Transaction.TransactionType.TRANSFER)
                .status(Transaction.TransactionStatus.COMPLETED)
                .idempotencyKey("refund:" + session.getId())
                .completedAt(LocalDateTime.now())
                .build();
        transactionRepository.save(tx);

        // Mark session as refunded
        session.setStatus(CheckoutSession.SessionStatus.REFUNDED);
        session.setRefundedAt(LocalDateTime.now());
        sessionRepository.save(session);

        log.info("Session refunded: sessionId={}, merchantId={}, amount={}", sessionId, merchantId, refundAmount);
        return toResponse(session, merchant);
    }
}
