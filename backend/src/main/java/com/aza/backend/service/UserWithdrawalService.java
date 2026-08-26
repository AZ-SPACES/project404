package com.aza.backend.service;

import com.aza.backend.entity.Notification;
import com.aza.backend.entity.User;
import com.aza.backend.entity.UserWithdrawal;
import com.aza.backend.entity.Wallet;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.UserWithdrawalRepository;
import com.aza.backend.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Optional;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * User cash-out (off-platform withdrawal) money flow.
 *
 * Funds are RESERVED (debited from the wallet) at request time inside a locked
 * transaction, so a balance can never be withdrawn more than once or spent while
 * a withdrawal is pending. Approval is a back-office acknowledgement that the cash
 * was paid out; rejection refunds the reserved amount. This mirrors the merchant
 * payout flow in {@code MerchantService.requestPayout}.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class UserWithdrawalService {

    private final UserWithdrawalRepository withdrawalRepository;
    private final WalletRepository walletRepository;
    private final WalletLedger walletLedger;
    private final UserRepository userRepository;
    private final UserService userService;
    private final NotificationService notificationService;

    @Transactional
    public UserWithdrawal request(User user, BigDecimal amount, String provider,
                                  String destination, String bankName, String passcode) {
        return request(user, amount, provider, destination, bankName, passcode, null);
    }

    @Transactional
    public UserWithdrawal request(User user, BigDecimal amount, String provider,
                                  String destination, String bankName, String passcode,
                                  String idempotencyKey) {
        // Replay check first: a retried request must return the original reservation, not
        // make a second one. Requesting a withdrawal debits the wallet, so a double submit
        // used to reserve the money twice and leave two PENDING rows.
        String key = idempotencyKey != null && !idempotencyKey.isBlank() ? idempotencyKey.trim() : null;
        if (key != null) {
            Optional<UserWithdrawal> replay =
                    withdrawalRepository.findByUserIdAndIdempotencyKey(user.getId(), key);
            if (replay.isPresent()) return replay.get();
        }

        // Verify passcode before taking any lock (avoids holding the row lock over the Redis round-trip).
        userService.verifyPasscode(user, passcode);

        Wallet wallet = walletRepository.findByUserIdForUpdate(user.getId())
                .orElseThrow(() -> new AppException("NO_WALLET", "Wallet not found", HttpStatus.NOT_FOUND));

        if (Boolean.TRUE.equals(wallet.getFrozen())) {
            throw new AppException("WALLET_FROZEN", "Your wallet is frozen", HttpStatus.FORBIDDEN);
        }
        if (wallet.getBalance() == null || wallet.getBalance().compareTo(amount) < 0) {
            throw new AppException("INSUFFICIENT_FUNDS",
                    "Insufficient balance for this withdrawal", HttpStatus.BAD_REQUEST);
        }

        // Reserve the funds immediately so they cannot be double-withdrawn or spent while pending.
        // The wallet is already locked above, so this applies the debit without re-locking.
        walletLedger.debitLocked(wallet, amount);

        UserWithdrawal withdrawal = withdrawalRepository.save(UserWithdrawal.builder()
                .userId(user.getId())
                .amount(amount)
                .provider(provider)
                .destination(destination)
                .bankName(bankName)
                .status(UserWithdrawal.WithdrawalStatus.PENDING)
                .idempotencyKey(key)
                .build());

        log.info("Withdrawal requested and funds reserved: userId={}, amount={}", user.getId(), amount);
        return withdrawal;
    }

    @Transactional
    public UserWithdrawal review(User admin, UUID id, String action, String note) {
        // Locked, not a plain read. Rejecting refunds the reserved funds, and the PENDING
        // check below is a read-modify-write on this row: two admins rejecting at the same
        // moment would otherwise both pass it and refund the same reservation twice.
        UserWithdrawal withdrawal = withdrawalRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Withdrawal not found", HttpStatus.NOT_FOUND));

        if (withdrawal.getStatus() != UserWithdrawal.WithdrawalStatus.PENDING) {
            throw new AppException("ALREADY_REVIEWED",
                    "This withdrawal has already been reviewed", HttpStatus.BAD_REQUEST);
        }

        UserWithdrawal.WithdrawalStatus newStatus = switch (action == null ? "" : action.toUpperCase()) {
            case "APPROVE" -> UserWithdrawal.WithdrawalStatus.APPROVED;
            case "REJECT" -> UserWithdrawal.WithdrawalStatus.REJECTED;
            default -> throw new AppException("INVALID_ACTION",
                    "action must be APPROVE or REJECT", HttpStatus.BAD_REQUEST);
        };

        // Approval just records that the off-platform payout happened — the funds were already
        // reserved at request time. Rejection returns the reserved funds to the wallet.
        if (newStatus == UserWithdrawal.WithdrawalStatus.REJECTED) {
            walletLedger.credit(
                    WalletLocker.personal(withdrawal.getUserId(), "Wallet not found"),
                    withdrawal.getAmount());
            log.info("Withdrawal rejected and funds refunded: id={}, amount={}", id, withdrawal.getAmount());
        }

        withdrawal.setStatus(newStatus);
        withdrawal.setAdminNote(note);
        withdrawal.setReviewedAt(LocalDateTime.now());
        withdrawal.setReviewedBy(admin.getId());
        withdrawalRepository.save(withdrawal);

        String title = newStatus == UserWithdrawal.WithdrawalStatus.APPROVED
                ? "Withdrawal Approved" : "Withdrawal Update";
        String body = newStatus == UserWithdrawal.WithdrawalStatus.APPROVED
                ? "Your withdrawal of GHS " + withdrawal.getAmount() + " has been approved and is being processed."
                : "Your withdrawal of GHS " + withdrawal.getAmount() + " could not be processed and the funds have been returned to your wallet. "
                    + (note != null ? note : "Please contact support.");
        notificationService.sendNotification(withdrawal.getUserId(),
                Notification.NotificationType.SECURITY_ALERT, title, body, null);

        return withdrawal;
    }
}
