package com.aza.backend.service;

import com.aza.backend.entity.RecurringTransfer;
import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.User;
import com.aza.backend.entity.Wallet;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.RecurringTransferRepository;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Runs one standing order, inside one transaction.
 *
 * <p><b>Why this is its own bean.</b> This method used to live on
 * {@link RecurringTransferService} as a {@code private @Transactional} method called
 * directly from the scheduler in the same class. Neither half of that works: Spring's
 * transaction support is proxy-based, so it cannot advise a private method, and a call
 * from one method of a class to another goes through {@code this} rather than the proxy
 * even when the target is public. The annotation was inert.
 *
 * <p>What that cost: the debit, the credit, and the transaction row each committed in
 * their own implicit repository transaction. A credit that failed after the debit had
 * committed left the payer debited and nobody credited — money destroyed, with no
 * rollback to undo it. It also silently defeated the row locking, because a pessimistic
 * lock lives only as long as its transaction: each {@code save} took the lock and released
 * it immediately, so two concurrent movements on the same wallet were never serialised.
 *
 * <p>Being a separate bean means the scheduler calls it through a real proxy, so one
 * transaction spans the whole transfer. It stays per-transfer rather than per-batch so
 * one bad standing order rolls back alone and the rest of the run continues.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RecurringTransferExecutor {

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
    public void execute(RecurringTransfer rt) {
        String identifier = rt.getRecipientIdentifier();
        User recipient = userRepository.findByEmailIgnoreCaseOrUsername(identifier, identifier).orElse(null);
        if (recipient == null || recipient.getStatus() != User.AccountStatus.ACTIVE) {
            throw new AppException("RECIPIENT_UNAVAILABLE", "Recipient not found or inactive", HttpStatus.BAD_REQUEST);
        }

        User sender = userRepository.findById(rt.getUserId())
                .orElseThrow(() -> new AppException("NOT_FOUND", "Sender not found", HttpStatus.NOT_FOUND));

        // A standing order is a transfer the payer set up earlier, not a transfer that
        // escapes the rules every other one obeys. It used to skip all three: it drained a
        // frozen wallet, ignored the payer's KYC tier cap, and moved money for free while
        // every other P2P path charged for it.

        // 1. A frozen wallet pays nobody. Checked before the lock so a frozen payer costs
        //    nothing to reject; the ledger takes the lock for the move itself.
        Wallet senderWallet = walletRepository.findByUserId(rt.getUserId())
                .orElseThrow(() -> new AppException("NOT_FOUND", "Sender wallet not found", HttpStatus.NOT_FOUND));
        if (Boolean.TRUE.equals(senderWallet.getFrozen())) {
            throw new AppException("WALLET_FROZEN",
                    "Your wallet is frozen, so this standing order did not run", HttpStatus.FORBIDDEN);
        }

        // 2. The payer's tier cap applies to money leaving on a schedule too.
        limitGuard.enforceSingle(sender, rt.getAmount());

        // 3. The same P2P fee as an equivalent manual transfer, so a standing order is not
        //    a free route around it.
        BigDecimal fee = feeCalculationService.quote("P2P", rt.getAmount(), rt.getUserId()).fee();

        // Locks both wallets in canonical order and applies the move. The insufficient-funds
        // check happens under the lock, inside the ledger, against amount + fee.
        walletLedger.transfer(
                WalletLocker.personal(rt.getUserId(), "Sender wallet not found"),
                WalletLocker.personal(recipient.getId(), "Recipient wallet not found"),
                rt.getAmount(), fee, null);

        feeCalculationService.recordMonthlyUsage("P2P", rt.getAmount(), rt.getUserId());

        String note = rt.getNote() != null && !rt.getNote().isBlank()
                ? rt.getNote()
                : "Recurring transfer";
        // Scored but never held — these are pre-authorized standing orders; a HIGH score
        // still raises an alert via the risk engine.
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

    /** When this standing order should next fire, counted from its current due time. */
    public LocalDateTime nextRunAt(RecurringTransfer rt) {
        LocalDateTime base = rt.getNextRunAt();
        return switch (rt.getFrequency()) {
            case DAILY -> base.plusDays(1);
            case WEEKLY -> base.plusWeeks(1);
            case MONTHLY -> base.plusMonths(1);
        };
    }
}
