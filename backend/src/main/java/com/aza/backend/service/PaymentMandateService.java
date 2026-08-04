package com.aza.backend.service;

import com.aza.backend.dto.mandate.MandateChargeResponse;
import com.aza.backend.dto.mandate.MandateResponse;
import com.aza.backend.entity.MandateCharge;
import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.PaymentMandate;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.MandateChargeRepository;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.repository.PaymentMandateRepository;
import com.aza.backend.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Direct debit: a user authorizes a merchant once (mini-app consent sheet or the OAuth /
 * aza-pay hosted approval page), and the merchant's own backend can charge that mandate
 * on-demand afterwards with no passcode re-entry — the same trade-off RecurringTransferService
 * already makes for standing transfers, just merchant-pulled instead of schedule-pushed.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentMandateService {

    private final PaymentMandateRepository mandateRepository;
    private final MandateChargeRepository chargeRepository;
    private final UserRepository userRepository;
    private final MerchantRepository merchantRepository;
    private final UserService userService;
    private final WebhookService webhookService;
    private final ObjectMapper objectMapper;
    private final MandateChargeExecutor chargeExecutor;
    private final MandateChargeAuditService chargeAudit;

    // ==================== CREATE & APPROVE ====================

    @Transactional
    public PaymentMandate create(UUID payerUserId, String recipientIdentifier, BigDecimal perChargeLimit,
                                  BigDecimal periodLimit, PaymentMandate.PeriodType periodType,
                                  LocalDateTime expiresAt, String reference,
                                  PaymentMandate.SourceType sourceType, String sourceId) {
        if (perChargeLimit == null || perChargeLimit.compareTo(BigDecimal.ZERO) <= 0) {
            throw new AppException("INVALID_AMOUNT", "perChargeLimit must be greater than zero", HttpStatus.BAD_REQUEST);
        }
        if (periodLimit != null) {
            if (periodLimit.compareTo(BigDecimal.ZERO) <= 0) {
                throw new AppException("INVALID_AMOUNT", "periodLimit must be greater than zero", HttpStatus.BAD_REQUEST);
            }
            if (periodType == null) {
                throw new AppException("PERIOD_TYPE_REQUIRED", "periodType is required when periodLimit is set", HttpStatus.BAD_REQUEST);
            }
            if (perChargeLimit.compareTo(periodLimit) > 0) {
                throw new AppException("INVALID_LIMITS", "perChargeLimit cannot exceed periodLimit", HttpStatus.BAD_REQUEST);
            }
        }
        if (expiresAt != null && expiresAt.isBefore(LocalDateTime.now())) {
            throw new AppException("INVALID_EXPIRY", "expiresAt must be in the future", HttpStatus.BAD_REQUEST);
        }

        Merchant merchant = resolveMerchant(recipientIdentifier);

        User payer = userRepository.findById(payerUserId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));
        if (payer.getStatus() != User.AccountStatus.ACTIVE) {
            throw new AppException("ACCOUNT_INACTIVE", "Your account is not active", HttpStatus.BAD_REQUEST);
        }

        PaymentMandate mandate = PaymentMandate.builder()
                .merchantId(merchant.getId())
                .payerUserId(payerUserId)
                .perChargeLimit(perChargeLimit)
                .periodLimit(periodLimit)
                .periodType(periodType)
                .expiresAt(expiresAt)
                .reference(reference != null && !reference.isBlank() ? reference : merchant.getBusinessName())
                .sourceType(sourceType)
                .sourceId(sourceId)
                .build();
        return mandateRepository.save(mandate);
    }

    @Transactional
    public PaymentMandate confirm(UUID userId, UUID mandateId, String passcode) {
        PaymentMandate mandate = getOwned(userId, mandateId);
        if (mandate.getStatus() != PaymentMandate.Status.PENDING_APPROVAL) {
            throw new AppException("INVALID_STATUS", "This mandate is not pending approval", HttpStatus.BAD_REQUEST);
        }
        User payer = userRepository.findById(userId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "User not found", HttpStatus.NOT_FOUND));
        userService.verifyPasscode(payer, passcode);

        mandate.setStatus(PaymentMandate.Status.ACTIVE);
        mandate.setApprovedAt(LocalDateTime.now());
        if (mandate.getPeriodType() != null) {
            mandate.setPeriodResetAt(MandateChargeExecutor.nextPeriodReset(LocalDateTime.now(), mandate.getPeriodType()));
        }
        return mandateRepository.save(mandate);
    }

    // ==================== USER-FACING MANAGEMENT ====================

    public List<PaymentMandate> list(UUID userId) {
        return mandateRepository.findAllByPayerUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::withExpiryChecked)
                .collect(Collectors.toList());
    }

    public PaymentMandate get(UUID userId, UUID mandateId) {
        return withExpiryChecked(getOwned(userId, mandateId));
    }

    /** No auth — merchant name/ceilings/cadence for the aza-pay hosted approval page before login. */
    public PaymentMandate getPublic(UUID mandateId) {
        PaymentMandate mandate = mandateRepository.findById(mandateId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Mandate not found", HttpStatus.NOT_FOUND));
        return withExpiryChecked(mandate);
    }

    /**
     * Flips an ACTIVE mandate past its expiresAt to EXPIRED and persists it — used by every read
     * path and by charge() before attempting a charge. A single mandateRepository.save() call is
     * atomic on its own (Spring Data wraps each repository method), so this doesn't need (and
     * deliberately doesn't carry) its own @Transactional: charge() in particular relies on this
     * commit surviving independently of whatever it does afterward in a *different* transaction
     * (MandateChargeExecutor), which a shared transactional boundary here would defeat.
     */
    PaymentMandate withExpiryChecked(PaymentMandate mandate) {
        if (mandate.getExpiresAt() != null && LocalDateTime.now().isAfter(mandate.getExpiresAt())
                && mandate.getStatus() == PaymentMandate.Status.ACTIVE) {
            mandate.setStatus(PaymentMandate.Status.EXPIRED);
            return mandateRepository.save(mandate);
        }
        return mandate;
    }

    @Transactional
    public PaymentMandate pause(UUID userId, UUID mandateId) {
        PaymentMandate mandate = getOwned(userId, mandateId);
        if (mandate.getStatus() != PaymentMandate.Status.ACTIVE) {
            throw new AppException("INVALID_STATUS", "Only active mandates can be paused", HttpStatus.BAD_REQUEST);
        }
        mandate.setStatus(PaymentMandate.Status.PAUSED);
        return mandateRepository.save(mandate);
    }

    @Transactional
    public PaymentMandate resume(UUID userId, UUID mandateId) {
        PaymentMandate mandate = getOwned(userId, mandateId);
        if (mandate.getStatus() != PaymentMandate.Status.PAUSED) {
            throw new AppException("INVALID_STATUS", "Only paused mandates can be resumed", HttpStatus.BAD_REQUEST);
        }
        mandate.setStatus(PaymentMandate.Status.ACTIVE);
        return mandateRepository.save(mandate);
    }

    @Transactional
    public PaymentMandate cancel(UUID userId, UUID mandateId) {
        PaymentMandate mandate = getOwned(userId, mandateId);
        if (mandate.getStatus() == PaymentMandate.Status.CANCELLED) {
            throw new AppException("ALREADY_CANCELLED", "Mandate is already cancelled", HttpStatus.BAD_REQUEST);
        }
        mandate.setStatus(PaymentMandate.Status.CANCELLED);
        mandateRepository.save(mandate);
        dispatchWebhookSafely(mandate, "mandate.cancelled", null, null, null);
        return mandate;
    }

    // ==================== MERCHANT-FACING ====================

    public Page<PaymentMandate> listForMerchant(UUID merchantId, Pageable pageable) {
        return mandateRepository.findAllByMerchantIdOrderByCreatedAtDesc(merchantId, pageable);
    }

    public Page<MandateCharge> listCharges(UUID merchantId, UUID mandateId, Pageable pageable) {
        PaymentMandate mandate = requireOwnedByMerchant(merchantId, mandateId);
        return chargeRepository.findAllByMandateIdOrderByCreatedAtDesc(mandate.getId(), pageable);
    }

    /**
     * Charges a mandate for a merchant. Deliberately NOT @Transactional itself — the debit/credit
     * happens in MandateChargeExecutor (a separate bean), and a validation failure there must
     * still leave a durable MandateCharge(FAILED) row via MandateChargeAuditService, which needs
     * its own transaction independent of the one that just rolled back. See both classes' javadoc.
     */
    public MandateCharge charge(UUID merchantId, UUID mandateId, BigDecimal amount, String reference, String idempotencyKey) {
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new AppException("IDEMPOTENCY_KEY_REQUIRED", "An Idempotency-Key header is required", HttpStatus.BAD_REQUEST);
        }
        Optional<MandateCharge> existing = chargeRepository.findByMerchantIdAndIdempotencyKey(merchantId, idempotencyKey);
        if (existing.isPresent()) {
            return existing.get();
        }
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new AppException("INVALID_AMOUNT", "Amount must be greater than zero", HttpStatus.BAD_REQUEST);
        }

        PaymentMandate mandate = withExpiryChecked(requireOwnedByMerchant(merchantId, mandateId));

        try {
            MandateCharge charge = chargeExecutor.execute(mandate, amount, reference, idempotencyKey);
            dispatchWebhookSafely(mandate, "mandate.charged", amount, charge.getTransactionId(), null);
            return charge;
        } catch (AppException e) {
            chargeAudit.recordFailure(mandate.getId(), merchantId, amount, idempotencyKey, e.getMessage());
            dispatchWebhookSafely(mandate, "mandate.charge_failed", amount, null, e.getMessage());
            throw e;
        }
    }

    // ==================== response mapping ====================

    public MandateResponse toResponse(PaymentMandate mandate) {
        Merchant merchant = merchantRepository.findById(mandate.getMerchantId()).orElse(null);
        return MandateResponse.builder()
                .id(mandate.getId())
                .merchantId(mandate.getMerchantId())
                .merchantName(merchant != null ? merchant.getBusinessName() : null)
                .merchantLogoUrl(merchant != null ? merchant.getLogoUrl() : null)
                .perChargeLimit(mandate.getPerChargeLimit())
                .periodLimit(mandate.getPeriodLimit())
                .periodType(mandate.getPeriodType() != null ? mandate.getPeriodType().name() : null)
                .periodSpent(mandate.getPeriodSpent())
                .periodResetAt(mandate.getPeriodResetAt())
                .expiresAt(mandate.getExpiresAt())
                .reference(mandate.getReference())
                .status(mandate.getStatus().name())
                .sourceType(mandate.getSourceType().name())
                .sourceId(mandate.getSourceId())
                .lastChargedAt(mandate.getLastChargedAt())
                .approvedAt(mandate.getApprovedAt())
                .createdAt(mandate.getCreatedAt())
                .build();
    }

    public MandateChargeResponse toChargeResponse(MandateCharge charge) {
        return MandateChargeResponse.builder()
                .id(charge.getId())
                .mandateId(charge.getMandateId())
                .amount(charge.getAmount())
                .status(charge.getStatus().name())
                .transactionId(charge.getTransactionId())
                .failureReason(charge.getFailureReason())
                .createdAt(charge.getCreatedAt())
                .build();
    }

    // ==================== helpers ====================

    private Merchant resolveMerchant(String recipientIdentifier) {
        String handle = recipientIdentifier.startsWith("@") ? recipientIdentifier.substring(1) : recipientIdentifier;
        Merchant merchant = merchantRepository.findByBusinessHandle(handle)
                .orElseThrow(() -> new AppException("MERCHANT_NOT_FOUND",
                        "No AZA merchant found with that handle. Direct debit can only be set up with a merchant.",
                        HttpStatus.NOT_FOUND));
        if (merchant.getStatus() != Merchant.MerchantStatus.ACTIVE) {
            throw new AppException("MERCHANT_INACTIVE", "Merchant is not active", HttpStatus.BAD_REQUEST);
        }
        return merchant;
    }

    private PaymentMandate getOwned(UUID userId, UUID mandateId) {
        PaymentMandate mandate = mandateRepository.findById(mandateId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Mandate not found", HttpStatus.NOT_FOUND));
        if (!mandate.getPayerUserId().equals(userId)) {
            throw new AppException("NOT_FOUND", "Mandate not found", HttpStatus.NOT_FOUND);
        }
        return mandate;
    }

    /** NOT_FOUND (not FORBIDDEN) on mismatch — a merchant must not learn that a mandate id exists for someone else. */
    private PaymentMandate requireOwnedByMerchant(UUID merchantId, UUID mandateId) {
        PaymentMandate mandate = mandateRepository.findById(mandateId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Mandate not found", HttpStatus.NOT_FOUND));
        if (!mandate.getMerchantId().equals(merchantId)) {
            throw new AppException("NOT_FOUND", "Mandate not found", HttpStatus.NOT_FOUND);
        }
        return mandate;
    }

    private void dispatchWebhookSafely(PaymentMandate mandate, String event, BigDecimal amount,
                                        UUID transactionId, String failureReason) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("event", event);
            payload.put("mandateId", mandate.getId().toString());
            payload.put("reference", mandate.getReference());
            if (amount != null) payload.put("amount", amount.toPlainString());
            if (transactionId != null) payload.put("transactionId", transactionId.toString());
            if (failureReason != null) payload.put("failureReason", failureReason);
            webhookService.dispatch(mandate.getMerchantId(), event, objectMapper.writeValueAsString(payload));
        } catch (Exception e) {
            log.error("Failed to dispatch {} webhook for mandate {}: {}", event, mandate.getId(), e.getMessage());
        }
    }
}
