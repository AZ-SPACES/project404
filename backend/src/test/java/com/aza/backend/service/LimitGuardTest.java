package com.aza.backend.service;

import com.aza.backend.entity.KycTier;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

class LimitGuardTest {

    private final LimitGuard guard = new LimitGuard();

    private User user(KycTier tier) {
        return User.builder().kycTier(tier).build();
    }

    @Test
    void nullTierDefaultsToTier1() {
        assertEquals(new BigDecimal("1000"), guard.singleLimit(User.builder().build()));
    }

    @Test
    void customSingleLimitOverridesTier() {
        User u = user(KycTier.TIER_1);
        u.setCustomSingleTransactionLimitGhs(new BigDecimal("7500"));
        assertEquals(new BigDecimal("7500"), guard.singleLimit(u));
    }

    @Test
    void enforceSingleRejectsOverTierCap() {
        AppException ex = assertThrows(AppException.class,
                () -> guard.enforceSingle(user(KycTier.TIER_1), new BigDecimal("1500")));
        assertTrue(ex.getMessage().contains("single-transaction limit"));
    }

    @Test
    void enforceWalletCeilingRejectsOverTierBalance() {
        AppException ex = assertThrows(AppException.class,
                () -> guard.enforceWalletCeiling(user(KycTier.TIER_1), new BigDecimal("5001")));
        assertTrue(ex.getMessage().contains("wallet limit"));
    }

    @Test
    void tier3HasNoWalletCeiling() {
        assertDoesNotThrow(() ->
                guard.enforceWalletCeiling(user(KycTier.TIER_3), new BigDecimal("1000000")));
    }
}
