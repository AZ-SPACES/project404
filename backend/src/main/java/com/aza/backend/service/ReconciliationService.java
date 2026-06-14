package com.aza.backend.service;

import com.aza.backend.entity.ReconBreak;
import com.aza.backend.entity.SafeguardingSnapshot;
import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.repository.ReconBreakRepository;
import com.aza.backend.repository.SafeguardingSnapshotRepository;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Finance back-office: safeguarding checks (platform float vs the safeguarded
 * bank balance that must back it 1:1) and statement reconciliation (matching
 * external rail statement lines to internal transactions, queueing breaks).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ReconciliationService {

    private final SafeguardingSnapshotRepository snapshotRepository;
    private final ReconBreakRepository breakRepository;
    private final WalletRepository walletRepository;
    private final MerchantRepository merchantRepository;
    private final TransactionRepository transactionRepository;
    private final AdminAuditService auditService;
    private final StaffAlertService staffAlertService;

    // ── Safeguarding ──────────────────────────────────────────────────────────

    @Transactional
    public SafeguardingSnapshot takeSnapshot(User admin, BigDecimal safeguardingBalance) {
        if (safeguardingBalance == null || safeguardingBalance.signum() < 0) {
            throw new AppException("INVALID_BALANCE", "Safeguarding balance must be a non-negative amount", HttpStatus.BAD_REQUEST);
        }
        SafeguardingSnapshot snapshot = buildSnapshot(safeguardingBalance);
        snapshot.setRecordedBy(admin != null ? admin.getId() : null);
        snapshot = snapshotRepository.save(snapshot);
        if (admin != null) {
            auditService.log(admin, "SAFEGUARDING_SNAPSHOT", null,
                    "bankBalance=" + safeguardingBalance + " variance=" + snapshot.getVariance()
                            + (snapshot.isBreach() ? " BREACH" : ""));
        }
        if (snapshot.isBreach()) {
            log.warn("SAFEGUARDING BREACH: float exceeds safeguarded balance by {}", snapshot.getVariance().negate());
            alertBreach(snapshot);
        }
        return snapshot;
    }

    /**
     * Daily scheduled check reusing the most recently entered bank balance —
     * catches float growing past the last known safeguarded amount between
     * manual entries. No-op until the first manual snapshot exists.
     */
    @Transactional
    public void takeScheduledSnapshot() {
        snapshotRepository.findFirstByOrderByCreatedAtDesc().ifPresent(last -> {
            SafeguardingSnapshot snapshot = snapshotRepository.save(buildSnapshot(last.getSafeguardingBalance()));
            if (snapshot.isBreach()) {
                log.warn("SAFEGUARDING BREACH (scheduled check): float exceeds safeguarded balance by {}",
                        snapshot.getVariance().negate());
                alertBreach(snapshot);
            }
        });
    }

    private void alertBreach(SafeguardingSnapshot snapshot) {
        staffAlertService.alertRole(com.aza.backend.entity.StaffRole.Role.FINANCE,
                "SAFEGUARDING BREACH",
                "Platform float (customer " + snapshot.getCustomerFloat() + " + merchant "
                        + snapshot.getMerchantFloat() + " GHS) exceeds the safeguarded balance of "
                        + snapshot.getSafeguardingBalance() + " GHS by "
                        + snapshot.getVariance().negate() + " GHS. Top up the safeguarding account immediately.");
    }

    private SafeguardingSnapshot buildSnapshot(BigDecimal safeguardingBalance) {
        BigDecimal customerFloat = orZero(walletRepository.sumTotalBalance());
        BigDecimal merchantFloat = orZero(merchantRepository.sumTotalMerchantBalance());
        // Agent float is part of customerFloat (agents are users with wallets); it is
        // reported separately for visibility and not subtracted again from variance.
        BigDecimal agentFloat = orZero(walletRepository.sumFloatForAgentStatus(
                com.aza.backend.entity.Agent.Status.ACTIVE));
        BigDecimal variance = safeguardingBalance.subtract(customerFloat).subtract(merchantFloat);
        return SafeguardingSnapshot.builder()
                .customerFloat(customerFloat)
                .merchantFloat(merchantFloat)
                .agentFloat(agentFloat)
                .safeguardingBalance(safeguardingBalance)
                .variance(variance)
                .breach(variance.signum() < 0)
                .build();
    }

    public Page<SafeguardingSnapshot> snapshotHistory(int page, int size) {
        return snapshotRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(page, size));
    }

    // ── Statement reconciliation ──────────────────────────────────────────────

    /**
     * Imports an external statement as CSV lines of "reference,amount,direction"
     * (direction CREDIT|DEBIT, header row optional). A line matches when its
     * reference is an internal transaction id with the same amount; everything
     * else becomes an OPEN break for FINANCE to work.
     */
    @Transactional
    public ImportResult importStatement(User admin, String label, String csv) {
        if (label == null || label.isBlank() || csv == null || csv.isBlank()) {
            throw new AppException("INVALID_IMPORT", "Both a label and CSV content are required", HttpStatus.BAD_REQUEST);
        }
        int matched = 0;
        List<ReconBreak> breaks = new ArrayList<>();
        String[] lines = csv.split("\\r?\\n");
        for (String line : lines) {
            line = line.trim();
            if (line.isEmpty() || line.toLowerCase().startsWith("reference")) continue;
            String[] cols = line.split(",");
            if (cols.length < 3) {
                throw new AppException("INVALID_CSV",
                        "Each line must be: reference,amount,direction — got: " + line, HttpStatus.BAD_REQUEST);
            }
            String reference = cols[0].trim();
            BigDecimal amount = parseAmount(cols[1].trim(), line);
            ReconBreak.Direction direction = parseDirection(cols[2].trim(), line);

            Transaction tx = findByReference(reference);
            if (tx != null && tx.getAmount().compareTo(amount) == 0) {
                matched++;
            } else {
                breaks.add(ReconBreak.builder()
                        .importLabel(label)
                        .statementReference(reference)
                        .statementAmount(amount)
                        .direction(direction)
                        .reason(tx == null ? ReconBreak.BreakReason.NO_MATCH : ReconBreak.BreakReason.AMOUNT_MISMATCH)
                        .internalAmount(tx != null ? tx.getAmount() : null)
                        .build());
            }
        }
        breakRepository.saveAll(breaks);
        auditService.log(admin, "RECON_IMPORT", null,
                "label=" + label + " matched=" + matched + " breaks=" + breaks.size());
        return new ImportResult(matched, breaks.size());
    }

    @Transactional
    public ReconBreak resolveBreak(User admin, UUID breakId, String notes) {
        ReconBreak reconBreak = breakRepository.findById(breakId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Break not found", HttpStatus.NOT_FOUND));
        if (reconBreak.getStatus() == ReconBreak.Status.RESOLVED) {
            throw new AppException("ALREADY_RESOLVED", "Break is already resolved", HttpStatus.CONFLICT);
        }
        if (notes == null || notes.isBlank()) {
            throw new AppException("NOTES_REQUIRED", "Resolution notes are required", HttpStatus.BAD_REQUEST);
        }
        reconBreak.setStatus(ReconBreak.Status.RESOLVED);
        reconBreak.setResolutionNotes(notes);
        reconBreak.setResolvedBy(admin.getId());
        reconBreak.setResolvedAt(LocalDateTime.now());
        auditService.log(admin, "RESOLVE_RECON_BREAK", null,
                "breakId=" + breakId + " ref=" + reconBreak.getStatementReference());
        return breakRepository.save(reconBreak);
    }

    public Page<ReconBreak> listBreaks(String status, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size);
        if (status == null || status.isBlank()) {
            return breakRepository.findAllByOrderByCreatedAtDesc(pageable);
        }
        return breakRepository.findByStatusOrderByCreatedAtDesc(
                ReconBreak.Status.valueOf(status.toUpperCase()), pageable);
    }

    public long openBreakCount() {
        return breakRepository.countByStatus(ReconBreak.Status.OPEN);
    }

    private Transaction findByReference(String reference) {
        try {
            return transactionRepository.findById(UUID.fromString(reference)).orElse(null);
        } catch (IllegalArgumentException e) {
            return null; // not a transaction id — no match
        }
    }

    private BigDecimal parseAmount(String raw, String line) {
        try {
            return new BigDecimal(raw);
        } catch (NumberFormatException e) {
            throw new AppException("INVALID_CSV", "Bad amount in line: " + line, HttpStatus.BAD_REQUEST);
        }
    }

    private ReconBreak.Direction parseDirection(String raw, String line) {
        try {
            return ReconBreak.Direction.valueOf(raw.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException("INVALID_CSV", "Direction must be CREDIT or DEBIT in line: " + line, HttpStatus.BAD_REQUEST);
        }
    }

    private static BigDecimal orZero(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    public record ImportResult(int matched, int breaks) {}
}
