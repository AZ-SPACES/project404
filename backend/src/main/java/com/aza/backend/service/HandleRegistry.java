package com.aza.backend.service;

import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * The single namespace for {@code @handles}.
 *
 * A payer types "@kofi" and cannot tell whether that is a person's username or a shop's
 * business handle — but those used to live in two tables that each only checked
 * themselves for collisions. A merchant could claim a handle an existing user already
 * held, print it on a store poster, and have every scan resolve to the user instead,
 * because recipient lookup tries users first. Both sides now ask this class before
 * granting a handle, so the namespace stays single and that misroute is unreachable
 * for anything registered from here on.
 *
 * Existing collisions predate this and are reported by V50's deploy-time warning;
 * the store-QR rail no longer depends on handle resolution at all (it sends an
 * explicit merchant recipient type), so they cannot misroute a scanned payment.
 */
@Service
@RequiredArgsConstructor
public class HandleRegistry {

    private final UserRepository userRepository;
    private final MerchantRepository merchantRepository;

    private static String normalize(String handle) {
        if (handle == null) return null;
        String trimmed = handle.trim().toLowerCase();
        return trimmed.startsWith("@") ? trimmed.substring(1) : trimmed;
    }

    /** True when no user and no merchant holds this handle. */
    public boolean isAvailable(String handle) {
        String normalized = normalize(handle);
        if (normalized == null || normalized.isEmpty()) return false;
        return !userRepository.existsByUsername(normalized)
                && !merchantRepository.existsByBusinessHandle(normalized);
    }

    /**
     * Available to {@code userId} as a username — free, or already theirs. Holding it
     * yourself is the one permitted overlap: it lets a profile save that leaves the
     * handle untouched through without a false conflict.
     *
     * A handle held by any merchant is refused even when the caller owns that merchant.
     * The two would resolve to different balances — a person's wallet and their shop's
     * merchant balance — so "pay @kofi" would land in the right hands but the wrong
     * account, and only one of the two is settled to a bank.
     */
    public boolean isAvailableToUser(String handle, UUID userId) {
        String normalized = normalize(handle);
        if (normalized == null || normalized.isEmpty()) return false;
        boolean heldByAnotherUser = userRepository.findByUsername(normalized)
                .map(u -> !u.getId().equals(userId))
                .orElse(false);
        return !heldByAnotherUser && !merchantRepository.existsByBusinessHandle(normalized);
    }

    /**
     * Available to the merchant owned by {@code ownerUserId} as a business handle —
     * free, or already that merchant's own. Refused if any user holds it, for the
     * reason given on {@link #isAvailableToUser}.
     */
    public boolean isAvailableToMerchant(String handle, UUID ownerUserId) {
        String normalized = normalize(handle);
        if (normalized == null || normalized.isEmpty()) return false;
        if (userRepository.existsByUsername(normalized)) return false;
        return merchantRepository.findByBusinessHandle(normalized)
                .map(m -> ownerUserId != null && m.getUserId().equals(ownerUserId))
                .orElse(true);
    }
}
