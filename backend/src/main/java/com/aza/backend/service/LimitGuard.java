package com.aza.backend.service;

import com.aza.backend.entity.KycTier;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

/**
 * Central place for KYC-tier limit enforcement, so every money-movement path applies
 * the same caps. A per-user custom override (set by back office) takes precedence over
 * the tier default for the single-transaction limit; the wallet-balance ceiling comes
 * from the tier alone.
 */
@Service
public class LimitGuard {

    public KycTier tierOf(User user) {
        return user.getKycTier() != null ? user.getKycTier() : KycTier.TIER_1;
    }

    /** The largest single transaction the user may make: their custom override, else the tier cap. */
    public BigDecimal singleLimit(User user) {
        return user.getCustomSingleTransactionLimitGhs() != null
                ? user.getCustomSingleTransactionLimitGhs()
                : tierOf(user).singleLimit();
    }

    /** The user's daily transaction cap: their custom override, else the tier cap. */
    public BigDecimal dailyLimit(User user) {
        return user.getCustomDailyLimitGhs() != null
                ? user.getCustomDailyLimitGhs()
                : tierOf(user).dailyLimit();
    }

    /** Rejects a transaction that exceeds the user's single-transaction limit. */
    public void enforceSingle(User user, BigDecimal amount) {
        BigDecimal limit = singleLimit(user);
        if (amount.compareTo(limit) > 0) {
            throw new AppException("LIMIT_EXCEEDED",
                    "Amount exceeds your single-transaction limit of GHS " + limit.toPlainString(),
                    HttpStatus.BAD_REQUEST);
        }
    }

    /** Rejects a credit that would push the wallet above the tier's balance ceiling. */
    public void enforceWalletCeiling(User user, BigDecimal newBalance) {
        BigDecimal ceiling = tierOf(user).maxBalance();
        if (ceiling != null && newBalance.compareTo(ceiling) > 0) {
            throw new AppException("BALANCE_LIMIT_EXCEEDED",
                    "This would exceed the GHS " + ceiling.toPlainString()
                            + " wallet limit for your account level. Upgrade your KYC to raise it.",
                    HttpStatus.BAD_REQUEST);
        }
    }
}
