package com.aza.backend.service;

import com.aza.backend.entity.Transaction;
import com.aza.backend.entity.Wallet;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * The single place a wallet balance changes.
 *
 * <p>Before this existed, twenty files each wrote their own
 * {@code wallet.setBalance(wallet.getBalance().add(x)); walletRepository.save(wallet);}
 * block. Three of them never took a row lock first, which is the read-modify-write race
 * that lets two concurrent requests both read the same balance and one of the two writes
 * vanish. Routing every balance change through here means the lock is not something a
 * caller can forget: the only way to move a balance is to call a method that has already
 * taken it.
 *
 * <p><b>Locking.</b> The {@code credit}/{@code debit}/{@code transfer} entry points take
 * the row lock themselves, two-sided ones in {@link WalletLocker}'s canonical order so
 * they cannot deadlock against each other. The {@code *Locked} variants are for callers
 * that must lock a wider set of rows in one go (a wallet plus a merchant, say) and have
 * therefore already taken the wallet lock as part of that set — they assert nothing about
 * locking and exist so those callers still share this class's arithmetic, validation, and
 * audit write rather than reimplementing them.
 *
 * <p><b>What this class does not decide.</b> Frozen-wallet policy stays with the callers:
 * an ordinary transfer must refuse a frozen wallet, while an admin reversal crediting a
 * frozen wallet is the entire point of the reversal. Passcode, limits, idempotency, and
 * authorization are likewise the caller's business — this class is the last mile, not the
 * gate.
 */
@Service
@RequiredArgsConstructor
public class WalletLedger {

    private final WalletRepository walletRepository;
    private final WalletLocker walletLocker;
    private final TransactionRepository transactionRepository;

    /** Both wallets of a transfer, in the order they were requested. */
    public record Moved(Wallet from, Wallet to) {}

    // ==================== single-sided ====================

    /**
     * Credits a wallet this method locks itself.
     *
     * <p>Used by the flows that create or receive value with no counterparty wallet —
     * a promo credit, a referral reward, {@code FloatService.mint}. Those write their own
     * audit record ({@code PromoCodeRedemption}, {@code Referral}, {@code FloatMovement}),
     * which is why no {@link Transaction} is written here.
     */
    public Wallet credit(WalletLocker.Target target, BigDecimal amount) {
        return creditLocked(walletLocker.lockOne(target), amount);
    }

    /** Debits a wallet this method locks itself. See {@link #credit} for when there is no Transaction. */
    public Wallet debit(WalletLocker.Target target, BigDecimal amount) {
        return debitLocked(walletLocker.lockOne(target), amount);
    }

    /** Credits a wallet the caller has already locked. */
    public Wallet creditLocked(Wallet wallet, BigDecimal amount) {
        requirePositive(amount);
        wallet.setBalance(wallet.getBalance().add(amount));
        return walletRepository.save(wallet);
    }

    /**
     * Debits a wallet the caller has already locked, refusing to overdraw it.
     *
     * <p>The balance check lives here rather than in the caller because it has to happen
     * after the lock is held — checking a balance read before the lock is exactly the
     * race this class exists to close.
     */
    public Wallet debitLocked(Wallet wallet, BigDecimal amount) {
        requirePositive(amount);
        requireFunds(wallet, amount);
        wallet.setBalance(wallet.getBalance().subtract(amount));
        return walletRepository.save(wallet);
    }

    // ==================== two-sided ====================

    /**
     * Moves money between two wallets, locking both in canonical order.
     *
     * <p>The source is debited {@code amount + fee} and the destination is credited
     * {@code amount}: the fee leaves circulation rather than landing in another wallet,
     * which is how it surfaces later as the bank-vs-float surplus. Pass
     * {@link BigDecimal#ZERO} for a fee-free move.
     *
     * @param txn stamped COMPLETED and saved inside this same transactional boundary, so
     *            a balance can never move without its audit row. May be null for the
     *            internal moves that record themselves elsewhere.
     */
    public Moved transfer(WalletLocker.Target from,
                          WalletLocker.Target to,
                          BigDecimal amount,
                          BigDecimal fee,
                          Transaction txn) {
        WalletLocker.Locked locked = walletLocker.lock(from, to);
        return transferLocked(locked.first(), locked.second(), amount, fee, txn);
    }

    /** As {@link #transfer}, for callers holding both locks already. */
    public Moved transferLocked(Wallet from,
                                Wallet to,
                                BigDecimal amount,
                                BigDecimal fee,
                                Transaction txn) {
        BigDecimal charged = fee == null ? BigDecimal.ZERO : fee;
        requirePositive(amount);
        if (charged.signum() < 0) {
            throw new AppException("INVALID_AMOUNT", "Fee cannot be negative", HttpStatus.BAD_REQUEST);
        }
        if (from.getId() != null && from.getId().equals(to.getId())) {
            throw new AppException("INVALID_RECIPIENT", "Cannot transfer to the same wallet", HttpStatus.BAD_REQUEST);
        }

        BigDecimal totalDebit = amount.add(charged);
        requireFunds(from, totalDebit);

        from.setBalance(from.getBalance().subtract(totalDebit));
        to.setBalance(to.getBalance().add(amount));
        walletRepository.save(from);
        walletRepository.save(to);

        if (txn != null) {
            txn.setFeeAmount(charged);
            txn.setStatus(Transaction.TransactionStatus.COMPLETED);
            txn.setCompletedAt(LocalDateTime.now());
            transactionRepository.save(txn);
        }
        return new Moved(from, to);
    }

    // ==================== guards ====================

    private static void requirePositive(BigDecimal amount) {
        if (amount == null || amount.signum() <= 0) {
            throw new AppException("INVALID_AMOUNT", "Amount must be greater than zero", HttpStatus.BAD_REQUEST);
        }
    }

    private static void requireFunds(Wallet wallet, BigDecimal amount) {
        if (wallet.getBalance().compareTo(amount) < 0) {
            throw new AppException("INSUFFICIENT_FUNDS", "Insufficient balance", HttpStatus.BAD_REQUEST);
        }
    }
}
