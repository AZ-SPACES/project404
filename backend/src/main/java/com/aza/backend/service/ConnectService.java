package com.aza.backend.service;

import com.aza.backend.dto.connect.ConnectBalanceResponse;
import com.aza.backend.dto.connect.ConnectRecipientResponse;
import com.aza.backend.dto.connect.ConnectTransferRequest;
import com.aza.backend.dto.connect.ConnectTransferResponse;
import com.aza.backend.entity.*;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.*;
import com.aza.backend.util.RateLimitService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Aza Connect — the marketplace-facing money rail. Lets a platform (a KYB'd merchant)
 * push funds from its balance directly into an individual seller's Aza wallet. This is
 * the "collect then pay sellers" half; split-at-checkout is handled in
 * {@link CheckoutService}. All movement is internal (GHS, Ghana-only v1).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ConnectService {

    private final MerchantRepository merchantRepository;
    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final TransactionRepository transactionRepository;
    private final ConnectTransferRepository connectTransferRepository;
    private final NotificationService notificationService;
    private final RateLimitService rateLimitService;

    // ==================== BALANCE ====================

    public ConnectBalanceResponse getBalance(UUID merchantId) {
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND));
        return ConnectBalanceResponse.builder()
                .available(merchant.getBalance())
                .currency(merchant.getCurrency())
                .build();
    }

    // ==================== RESOLVE RECIPIENT ====================

    /**
     * Confirm a seller can be paid before sending. Rate limited per merchant to stop the
     * endpoint being used to enumerate Aza accounts. Returns only existence + a masked name.
     */
    public ConnectRecipientResponse resolveRecipient(UUID merchantId, String identifier) {
        rateLimitService.enforceRateLimit("connect:resolve:" + merchantId, 60, Duration.ofMinutes(1));

        if (identifier == null || identifier.isBlank()) {
            throw new AppException("VALIDATION", "identifier is required", HttpStatus.BAD_REQUEST);
        }
        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND));

        String id = identifier.trim();
        User user = userRepository.findByEmailIgnoreCaseOrUsername(id, id).orElse(null);
        if (user == null) {
            return ConnectRecipientResponse.builder()
                    .found(false).canReceive(false)
                    .reason("No Aza account matches that email or username")
                    .build();
        }

        String reason = null;
        boolean canReceive = true;
        if (user.getId().equals(merchant.getUserId())) {
            canReceive = false; reason = "This is your own account";
        } else if (user.getStatus() != User.AccountStatus.ACTIVE) {
            canReceive = false; reason = "Account is not active";
        } else {
            Wallet w = walletRepository.findByUserId(user.getId()).orElse(null);
            if (w == null) {
                canReceive = false; reason = "Recipient has no wallet";
            } else if (Boolean.TRUE.equals(w.getFrozen())) {
                canReceive = false; reason = "Recipient wallet is frozen";
            }
        }

        return ConnectRecipientResponse.builder()
                .found(true)
                .canReceive(canReceive)
                .userId(user.getId())
                .displayName(maskName(user))
                .reason(reason)
                .build();
    }

    // ==================== SINGLE TRANSFER ====================

    @Transactional
    public ConnectTransferResponse transfer(UUID merchantId, boolean testMode, ConnectTransferRequest request) {
        String idemKey = normalizeKey(request.getIdempotencyKey());

        // Fast path: a completed transfer already exists for this key.
        if (idemKey != null) {
            ConnectTransfer existing = connectTransferRepository
                    .findByMerchantIdAndIdempotencyKey(merchantId, idemKey).orElse(null);
            if (existing != null) return toResponse(existing);
        }

        BigDecimal amount = request.getAmount().setScale(2, java.math.RoundingMode.HALF_UP);
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new AppException("INVALID_AMOUNT", "amount must be greater than 0", HttpStatus.BAD_REQUEST);
        }

        // Lock the platform merchant for the whole transfer — serialises this platform's
        // transfers and checkouts so balances can't be lost to concurrent updates, and
        // makes the idempotency check-then-insert below race-free per merchant.
        Merchant merchant = merchantRepository.findByIdForUpdate(merchantId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND));

        // Authoritative idempotency check under the lock.
        if (idemKey != null) {
            ConnectTransfer existing = connectTransferRepository
                    .findByMerchantIdAndIdempotencyKey(merchantId, idemKey).orElse(null);
            if (existing != null) return toResponse(existing);
        }

        if (merchant.getStatus() != Merchant.MerchantStatus.ACTIVE) {
            throw new AppException("NOT_ACTIVE",
                    "Your merchant account must be active to send transfers", HttpStatus.FORBIDDEN);
        }

        String identifier = request.getRecipient().trim();
        User recipient = userRepository.findByEmailIgnoreCaseOrUsername(identifier, identifier).orElse(null);
        if (recipient == null) {
            throw new AppException("RECIPIENT_NOT_FOUND",
                    "No Aza account matches '" + identifier + "'", HttpStatus.BAD_REQUEST);
        }
        if (recipient.getId().equals(merchant.getUserId())) {
            throw new AppException("SELF_TRANSFER",
                    "You cannot transfer to your own account", HttpStatus.BAD_REQUEST);
        }
        if (recipient.getStatus() != User.AccountStatus.ACTIVE) {
            throw new AppException("RECIPIENT_INACTIVE",
                    "Recipient account is not active", HttpStatus.BAD_REQUEST);
        }

        // Sandbox: an aza_test_ key validates the whole request but moves no money.
        if (testMode) {
            ConnectTransfer sim = ConnectTransfer.builder()
                    .merchantId(merchantId)
                    .recipientUserId(recipient.getId())
                    .recipientIdentifier(identifier)
                    .amount(amount)
                    .currency(merchant.getCurrency())
                    .note(request.getNote())
                    .reference(request.getReference())
                    .status(ConnectTransfer.Status.SIMULATED)
                    .testMode(true)
                    .idempotencyKey(idemKey)
                    .processedAt(LocalDateTime.now())
                    .build();
            return toResponse(saveTransfer(sim));
        }

        // Lock ordering matches CheckoutService: merchant first, then wallet.
        Wallet recipientWallet = walletRepository.findByUserIdForUpdate(recipient.getId())
                .orElseThrow(() -> new AppException("NO_WALLET", "Recipient has no wallet", HttpStatus.BAD_REQUEST));
        if (Boolean.TRUE.equals(recipientWallet.getFrozen())) {
            throw new AppException("WALLET_FROZEN", "Recipient wallet is frozen", HttpStatus.BAD_REQUEST);
        }
        if (merchant.getBalance().compareTo(amount) < 0) {
            throw new AppException("INSUFFICIENT_FUNDS",
                    "Merchant balance is insufficient. Available: " + merchant.getCurrency() + " "
                            + merchant.getBalance() + ", Required: " + merchant.getCurrency() + " " + amount,
                    HttpStatus.BAD_REQUEST);
        }

        // Debit platform, credit seller.
        merchant.setBalance(merchant.getBalance().subtract(amount));
        merchantRepository.save(merchant);

        recipientWallet.setBalance(recipientWallet.getBalance().add(amount));
        walletRepository.save(recipientWallet);
        recipient.setBalance(recipientWallet.getBalance());
        userRepository.save(recipient);

        ConnectTransfer transfer = ConnectTransfer.builder()
                .merchantId(merchantId)
                .recipientUserId(recipient.getId())
                .recipientIdentifier(identifier)
                .amount(amount)
                .currency(merchant.getCurrency())
                .note(request.getNote())
                .reference(request.getReference())
                .status(ConnectTransfer.Status.COMPLETED)
                .testMode(false)
                .idempotencyKey(idemKey)
                .processedAt(LocalDateTime.now())
                .build();
        transfer = saveTransfer(transfer);

        String txNote = (request.getNote() != null && !request.getNote().isBlank())
                ? request.getNote()
                : "Transfer from " + merchant.getBusinessName();
        Transaction tx = Transaction.builder()
                .senderId(merchant.getUserId())
                .recipientId(recipient.getId())
                .amount(amount)
                .note(txNote)
                .type(Transaction.TransactionType.TRANSFER)
                .status(Transaction.TransactionStatus.COMPLETED)
                .idempotencyKey("connect:" + transfer.getId())
                .completedAt(LocalDateTime.now())
                .build();
        transactionRepository.save(tx);

        transfer.setTransactionId(tx.getId());
        connectTransferRepository.save(transfer);

        notificationService.sendNotification(
                recipient.getId(),
                Notification.NotificationType.MONEY_RECEIVED,
                "Money Received",
                merchant.getBusinessName() + " sent you " + merchant.getCurrency() + " " + amount,
                null);

        log.info("Connect transfer completed: id={}, merchantId={}, recipient={}, amount={}",
                transfer.getId(), merchantId, recipient.getId(), amount);
        return toResponse(transfer);
    }

    // ==================== HISTORY ====================

    public Page<ConnectTransferResponse> listTransfers(UUID merchantId, int page, int size) {
        return connectTransferRepository
                .findAllByMerchantIdOrderByCreatedAtDesc(merchantId, PageRequest.of(page, Math.min(size, 50)))
                .map(this::toResponse);
    }

    public ConnectTransferResponse getTransfer(UUID merchantId, UUID id) {
        ConnectTransfer transfer = connectTransferRepository.findByIdAndMerchantId(id, merchantId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Transfer not found", HttpStatus.NOT_FOUND));
        return toResponse(transfer);
    }

    // ==================== HELPERS ====================

    private ConnectTransfer saveTransfer(ConnectTransfer t) {
        try {
            return connectTransferRepository.save(t);
        } catch (DataIntegrityViolationException dup) {
            // Lost the idempotency race — return the transfer the winner persisted.
            if (t.getIdempotencyKey() != null) {
                ConnectTransfer existing = connectTransferRepository
                        .findByMerchantIdAndIdempotencyKey(t.getMerchantId(), t.getIdempotencyKey()).orElse(null);
                if (existing != null) return existing;
            }
            throw dup;
        }
    }

    private String normalizeKey(String key) {
        if (key == null) return null;
        String k = key.trim();
        return k.isEmpty() ? null : k;
    }

    private String maskName(User u) {
        String first = u.getFirstName() != null ? u.getFirstName() : "";
        String last = u.getLastName();
        String lastInitial = (last != null && !last.isBlank()) ? " " + last.trim().charAt(0) + "." : "";
        String name = (first + lastInitial).trim();
        return name.isEmpty() ? "Aza user" : name;
    }

    private ConnectTransferResponse toResponse(ConnectTransfer t) {
        return ConnectTransferResponse.builder()
                .id(t.getId())
                .recipient(t.getRecipientIdentifier())
                .recipientUserId(t.getRecipientUserId())
                .amount(t.getAmount())
                .currency(t.getCurrency())
                .note(t.getNote())
                .reference(t.getReference())
                .status(t.getStatus().name())
                .failureReason(t.getFailureReason())
                .testMode(t.getTestMode())
                .createdAt(t.getCreatedAt())
                .processedAt(t.getProcessedAt())
                .build();
    }
}
