package com.aza.backend.service;

import com.aza.backend.dto.merchant.CheckoutSessionResponse;
import com.aza.backend.dto.merchant.ConfirmCheckoutRequest;
import com.aza.backend.dto.merchant.CreateCheckoutSessionRequest;
import com.aza.backend.entity.*;
import com.aza.backend.exception.AppException;
import com.aza.backend.entity.Transaction;
import com.aza.backend.repository.*;
import com.aza.backend.util.RateLimitService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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

    private static final int SESSION_TTL_MINUTES = 30;

    // ==================== CREATE SESSION ====================

    @Transactional
    public CheckoutSessionResponse createSession(UUID merchantId, CreateCheckoutSessionRequest request) {
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
                .build();

        sessionRepository.save(session);
        log.info("Checkout session created: id={}, merchantId={}, amount={}", session.getId(), merchantId, request.getAmount());
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

    private void scheduleWebhookDelivery(CheckoutSession session, Merchant merchant) {
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
            throw new RuntimeException("Failed to build webhook payload", e);
        }
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
                .amount(s.getAmount())
                .currency(s.getCurrency())
                .description(s.getDescription())
                .status(s.getStatus().name())
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
                .createdAt(s.getCreatedAt())
                .expiresAt(s.getExpiresAt())
                .completedAt(s.getCompletedAt())
                .build();
    }
}
