package com.aza.backend.service;

import com.aza.backend.dto.transfer.CreateRecurringTransferRequest;
import com.aza.backend.dto.transfer.RecurringTransferResponse;
import com.aza.backend.entity.*;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class RecurringTransferService {

    private final RecurringTransferRepository recurringTransferRepository;
    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final WalletLedger walletLedger;
    private final TransactionRepository transactionRepository;
    private final AnomalyDetectionService anomalyDetectionService;
    private final RiskEngineService riskEngineService;
    private final LimitGuard limitGuard;
    private final FeeCalculationService feeCalculationService;

    @Transactional
    public RecurringTransferResponse create(UUID userId, CreateRecurringTransferRequest req) {
        // Idempotency: return existing record if key already used
        if (req.getIdempotencyKey() != null && !req.getIdempotencyKey().isBlank()) {
            java.util.Optional<RecurringTransfer> existing =
                    recurringTransferRepository.findByIdempotencyKey(req.getIdempotencyKey());
            if (existing.isPresent()) {
                // Ownership guard: keys are globally unique across all users, so a replayed
                // key must belong to the caller or it would leak another user's schedule
                // (recipient, amount, cadence).
                if (!existing.get().getUserId().equals(userId)) {
                    throw new AppException("INVALID_IDEMPOTENCY_KEY", "Invalid idempotency key",
                            HttpStatus.CONFLICT);
                }
                return toResponse(existing.get());
            }
        }

        String identifier = req.getRecipientIdentifier().trim();
        User recipient = userRepository.findByEmailIgnoreCaseOrUsername(identifier, identifier)
                .orElseThrow(() -> new AppException("RECIPIENT_NOT_FOUND",
                        "No user found with that email or username", HttpStatus.NOT_FOUND));

        if (recipient.getId().equals(userId)) {
            throw new AppException("SELF_TRANSFER", "Cannot set up a recurring transfer to yourself", HttpStatus.BAD_REQUEST);
        }

        if (recipient.getStatus() != User.AccountStatus.ACTIVE) {
            throw new AppException("RECIPIENT_INACTIVE", "Recipient account is not active", HttpStatus.BAD_REQUEST);
        }

        LocalDateTime nextRunAt = req.getStartDate().atStartOfDay();
        if (nextRunAt.isBefore(LocalDateTime.now())) {
            nextRunAt = LocalDateTime.now().plusMinutes(5);
        }

        RecurringTransfer rt = RecurringTransfer.builder()
                .userId(userId)
                .recipientIdentifier(identifier)
                .amount(req.getAmount())
                .note(req.getNote())
                .frequency(req.getFrequency())
                .nextRunAt(nextRunAt)
                .idempotencyKey(req.getIdempotencyKey() != null && !req.getIdempotencyKey().isBlank()
                        ? req.getIdempotencyKey() : null)
                .build();

        recurringTransferRepository.save(rt);
        log.info("Recurring transfer created: id={}, userId={}, frequency={}", rt.getId(), userId, rt.getFrequency());
        return toResponse(rt);
    }

    public List<RecurringTransferResponse> list(UUID userId) {
        return recurringTransferRepository.findAllByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public RecurringTransferResponse pause(UUID userId, UUID id) {
        RecurringTransfer rt = getOwned(userId, id);
        if (rt.getStatus() != RecurringTransfer.Status.ACTIVE) {
            throw new AppException("INVALID_STATUS", "Only active recurring transfers can be paused", HttpStatus.BAD_REQUEST);
        }
        rt.setStatus(RecurringTransfer.Status.PAUSED);
        recurringTransferRepository.save(rt);
        return toResponse(rt);
    }

    @Transactional
    public RecurringTransferResponse resume(UUID userId, UUID id) {
        RecurringTransfer rt = getOwned(userId, id);
        if (rt.getStatus() != RecurringTransfer.Status.PAUSED) {
            throw new AppException("INVALID_STATUS", "Only paused recurring transfers can be resumed", HttpStatus.BAD_REQUEST);
        }
        rt.setStatus(RecurringTransfer.Status.ACTIVE);
        recurringTransferRepository.save(rt);
        return toResponse(rt);
    }

    @Transactional
    public void cancel(UUID userId, UUID id) {
        RecurringTransfer rt = getOwned(userId, id);
        if (rt.getStatus() == RecurringTransfer.Status.CANCELLED) {
            throw new AppException("ALREADY_CANCELLED", "Recurring transfer is already cancelled", HttpStatus.BAD_REQUEST);
        }
        rt.setStatus(RecurringTransfer.Status.CANCELLED);
        recurringTransferRepository.save(rt);
    }

    @Scheduled(cron = "0 0 8 * * *", zone = "Africa/Accra")
    public void processDueTransfers() {
        List<RecurringTransfer> due = recurringTransferRepository
                .findAllByStatusAndNextRunAtBefore(RecurringTransfer.Status.ACTIVE, LocalDateTime.now());

        if (due.isEmpty()) return;

        log.info("Processing {} due recurring transfer(s)", due.size());
        int processed = 0;
        int failed = 0;

        for (RecurringTransfer rt : due) {
            try {
                executeTransfer(rt);
                processed++;
            } catch (Exception e) {
                log.warn("Recurring transfer {} failed: {}", rt.getId(), e.getMessage());
                rt.setLastFailureReason(e.getMessage());
                rt.setTotalRuns(rt.getTotalRuns() + 1);
                rt.setNextRunAt(nextRunAt(rt));
                recurringTransferRepository.save(rt);
                failed++;
            }
        }

        log.info("Recurring transfers: {} processed, {} failed", processed, failed);
    }

    @Transactional
    private void executeTransfer(RecurringTransfer rt) {
        String identifier = rt.getRecipientIdentifier();
        User recipient = userRepository.findByEmailIgnoreCaseOrUsername(identifier, identifier).orElse(null);
        if (recipient == null || recipient.getStatus() != User.AccountStatus.ACTIVE) {
            throw new RuntimeException("Recipient not found or inactive");
        }

        User sender = userRepository.findById(rt.getUserId())
                .orElseThrow(() -> new RuntimeException("Sender not found"));

        // A standing order is a transfer the payer set up earlier, not a transfer that
        // escapes the rules that apply to every other one. Before this, it skipped all
        // three: it drained a frozen wallet, ignored the payer's KYC tier cap, and moved
        // money for free while every other P2P path charged for it.

        // 1. A frozen wallet pays nobody. Checked before the lock so a frozen payer costs
        //    nothing to reject; the ledger takes the lock for the move itself.
        Wallet senderWallet = walletRepository.findByUserId(rt.getUserId())
                .orElseThrow(() -> new RuntimeException("Sender wallet not found"));
        if (Boolean.TRUE.equals(senderWallet.getFrozen())) {
            throw new AppException("WALLET_FROZEN",
                    "Your wallet is frozen, so this standing order did not run", HttpStatus.FORBIDDEN);
        }

        // 2. The payer's tier cap applies to money leaving on a schedule too.
        limitGuard.enforceSingle(sender, rt.getAmount());

        // 3. The same P2P fee as an equivalent manual transfer, so a standing order is not
        //    a free route around it.
        BigDecimal fee = feeCalculationService.quote("P2P", rt.getAmount(), rt.getUserId()).fee();

        // Locks both wallets in canonical order and applies the move. The recipient's
        // wallet was previously read without a lock, so a standing order landing at the
        // same moment as any other credit could overwrite it. The insufficient-funds
        // check now happens under the lock, inside the ledger, against amount + fee.
        walletLedger.transfer(
                WalletLocker.personal(rt.getUserId(), "Sender wallet not found"),
                WalletLocker.personal(recipient.getId(), "Recipient wallet not found"),
                rt.getAmount(), fee, null);

        feeCalculationService.recordMonthlyUsage("P2P", rt.getAmount(), rt.getUserId());

        String note = rt.getNote() != null && !rt.getNote().isBlank()
                ? rt.getNote()
                : "Recurring transfer";
        // Scored but never held — these are pre-authorized standing orders; a HIGH
        // score still raises an alert via the risk engine.
        AnomalyDetectionService.Result anomaly;
        try {
            anomaly = anomalyDetectionService.score(rt.getUserId(), recipient.getId(), rt.getAmount(), LocalDateTime.now());
        } catch (Exception e) {
            anomaly = new AnomalyDetectionService.Result(0.0, "LOW", null);
        }
        Transaction tx = Transaction.builder()
                .senderId(rt.getUserId())
                .recipientId(recipient.getId())
                .amount(rt.getAmount())
                .note(note)
                .type(Transaction.TransactionType.TRANSFER)
                .status(Transaction.TransactionStatus.COMPLETED)
                .idempotencyKey("recurring:" + rt.getId() + ":" + rt.getTotalRuns())
                .completedAt(LocalDateTime.now())
                .feeAmount(fee)
                .anomalyScore(anomaly.score())
                .anomalyRiskLevel(anomaly.riskLevel())
                .build();
        transactionRepository.save(tx);
        riskEngineService.evaluateTransfer(tx, sender);

        rt.setTotalRuns(rt.getTotalRuns() + 1);
        rt.setSuccessfulRuns(rt.getSuccessfulRuns() + 1);
        rt.setLastRunAt(LocalDateTime.now());
        rt.setLastFailureReason(null);
        rt.setNextRunAt(nextRunAt(rt));
        recurringTransferRepository.save(rt);
    }

    private LocalDateTime nextRunAt(RecurringTransfer rt) {
        LocalDateTime base = rt.getNextRunAt();
        return switch (rt.getFrequency()) {
            case DAILY -> base.plusDays(1);
            case WEEKLY -> base.plusWeeks(1);
            case MONTHLY -> base.plusMonths(1);
        };
    }

    private RecurringTransfer getOwned(UUID userId, UUID id) {
        RecurringTransfer rt = recurringTransferRepository.findById(id)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Recurring transfer not found", HttpStatus.NOT_FOUND));
        if (!rt.getUserId().equals(userId)) {
            throw new AppException("FORBIDDEN", "Not your recurring transfer", HttpStatus.FORBIDDEN);
        }
        return rt;
    }

    private RecurringTransferResponse toResponse(RecurringTransfer rt) {
        return RecurringTransferResponse.builder()
                .id(rt.getId())
                .recipientIdentifier(rt.getRecipientIdentifier())
                .amount(rt.getAmount())
                .note(rt.getNote())
                .frequency(rt.getFrequency().name())
                .nextRunAt(rt.getNextRunAt())
                .status(rt.getStatus().name())
                .totalRuns(rt.getTotalRuns())
                .successfulRuns(rt.getSuccessfulRuns())
                .lastRunAt(rt.getLastRunAt())
                .lastFailureReason(rt.getLastFailureReason())
                .createdAt(rt.getCreatedAt())
                .build();
    }
}
