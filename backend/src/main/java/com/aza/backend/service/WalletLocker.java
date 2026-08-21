package com.aza.backend.service;

import com.aza.backend.entity.Wallet;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Acquires two wallet row locks in a canonical order.
 *
 * <p>Two transactions that lock the same pair of wallets in opposite orders deadlock:
 * A→B holds A and waits on B while B→A holds B and waits on A. PostgreSQL breaks the
 * cycle by aborting one of them, which surfaces to the user as a failed transfer. No
 * money is lost — the balance updates are still safe — but a legitimate transfer fails
 * for a reason that is entirely avoidable.
 *
 * <p>Sorting the two wallet identities before locking makes the acquisition order the
 * same for every caller, so the cycle can never form. The sort key is
 * {@code (userId, type)} rather than {@code userId} alone, because one user may hold
 * both a PERSONAL and an AGENT_FLOAT wallet — the user id on its own does not identify
 * a wallet row.
 *
 * <p>{@link Locked} hands the wallets back in the order they were <em>requested</em>,
 * so callers never have to think about which one was actually locked first.
 */
@Service
@RequiredArgsConstructor
public class WalletLocker {

    private final WalletRepository walletRepository;

    /**
     * One wallet to lock: which user, which of their wallets, and the message to fail
     * with if that wallet does not exist.
     */
    public record Target(UUID userId, Wallet.WalletType type, String notFoundMessage) {

        int order(Target other) {
            int byUser = userId.compareTo(other.userId);
            return byUser != 0 ? byUser : type.compareTo(other.type);
        }
    }

    /** The two wallets, in the order they were requested — not the order they were locked in. */
    public record Locked(Wallet first, Wallet second) {}

    public static Target personal(UUID userId, String notFoundMessage) {
        return new Target(userId, Wallet.WalletType.PERSONAL, notFoundMessage);
    }

    public static Target agentFloat(UUID userId, String notFoundMessage) {
        return new Target(userId, Wallet.WalletType.AGENT_FLOAT, notFoundMessage);
    }

    /**
     * Locks both wallets, lowest {@code (userId, type)} first, and returns them in the
     * order they were passed in.
     */
    public Locked lock(Target first, Target second) {
        if (first.order(second) < 0) {
            Wallet a = lockOne(first);
            Wallet b = lockOne(second);
            return new Locked(a, b);
        }
        // Lock the second one first; the caller still gets (first, second) back.
        Wallet b = lockOne(second);
        Wallet a = lockOne(first);
        return new Locked(a, b);
    }

    private Wallet lockOne(Target target) {
        // findByUserIdForUpdate is the canonical PERSONAL-wallet accessor used throughout
        // the codebase (its query is already scoped to PERSONAL). Routing through it keeps
        // this helper's behaviour identical to the direct calls it replaces.
        var found = target.type() == Wallet.WalletType.PERSONAL
                ? walletRepository.findByUserIdForUpdate(target.userId())
                : walletRepository.findByUserIdAndTypeForUpdate(target.userId(), target.type());
        return found.orElseThrow(() -> new AppException(target.notFoundMessage()));
    }
}
