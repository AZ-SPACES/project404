package com.aza.backend.service;

import com.aza.backend.entity.User;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.WalletRepository;
import com.aza.backend.util.PhoneNumberUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Resolves an integrator-supplied identifier to a payable Aza user.
 *
 * Phone is the primary identifier for Ghanaian recipients, but the marketplace paths
 * historically resolved by email or username only — so a plumber identified as
 * "+233241234567" could never be paid. Every recipient lookup on the merchant rail
 * goes through here so all of them accept the same three identifier shapes and agree
 * on what "payable" means.
 *
 * Phone matching is delegated to {@link PhoneNumberUtil#normalize} — the same
 * canonicalisation signup and SMS use, so "0241234567", "+2330241234567" and
 * "+233241234567" all find the same account.
 */
@Service
@RequiredArgsConstructor
public class RecipientResolver {

    private final UserRepository userRepository;
    private final WalletRepository walletRepository;

    /** Why a resolved user cannot receive money right now, or null when they can. */
    public enum Unpayable {
        NOT_FOUND("Recipient not found"),
        INACTIVE("Recipient account is not active"),
        NO_WALLET("Recipient has no wallet"),
        WALLET_FROZEN("Recipient wallet is frozen");

        public final String reason;
        Unpayable(String reason) { this.reason = reason; }
    }

    public record Resolution(User user, Unpayable problem) {
        public boolean payable() { return problem == null; }
    }

    /**
     * Find the account for {@code identifier} — phone, then email, then username —
     * without judging whether it can be paid.
     */
    public Optional<User> find(String identifier) {
        if (identifier == null) return Optional.empty();
        String trimmed = identifier.trim();
        if (trimmed.isEmpty()) return Optional.empty();

        if (PhoneNumberUtil.looksLikePhone(trimmed)) {
            Optional<User> byPhone = userRepository.findByPhoneNumber(PhoneNumberUtil.normalize(trimmed));
            if (byPhone.isPresent()) return byPhone;
        }

        // "@handle" and "handle" are the same username.
        String username = trimmed.startsWith("@") ? trimmed.substring(1) : trimmed;
        return userRepository.findByEmailIgnoreCaseOrUsername(trimmed, username);
    }

    /**
     * Find the account and check it can actually receive money. Used both at session
     * creation (fail before the payer is charged) and again at release (state can
     * change during a hold).
     */
    public Resolution resolve(String identifier) {
        User user = find(identifier).orElse(null);
        if (user == null) return new Resolution(null, Unpayable.NOT_FOUND);
        if (user.getStatus() != User.AccountStatus.ACTIVE) return new Resolution(user, Unpayable.INACTIVE);

        var wallet = walletRepository.findByUserId(user.getId()).orElse(null);
        if (wallet == null) return new Resolution(user, Unpayable.NO_WALLET);
        if (Boolean.TRUE.equals(wallet.getFrozen())) return new Resolution(user, Unpayable.WALLET_FROZEN);

        return new Resolution(user, null);
    }
}
