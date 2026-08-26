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
    private final RecurringTransferExecutor executor;

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
                // Through the injected bean, not this.executeTransfer(...): a self-call
                // bypasses the proxy and would leave the transfer running with no
                // transaction at all.
                executor.execute(rt);
                processed++;
            } catch (Exception e) {
                log.warn("Recurring transfer {} failed: {}", rt.getId(), e.getMessage());
                rt.setLastFailureReason(e.getMessage());
                rt.setTotalRuns(rt.getTotalRuns() + 1);
                rt.setNextRunAt(executor.nextRunAt(rt));
                recurringTransferRepository.save(rt);
                failed++;
            }
        }

        log.info("Recurring transfers: {} processed, {} failed", processed, failed);
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
