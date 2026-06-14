package com.aza.backend.controller;

import com.aza.backend.entity.PromoCode;
import com.aza.backend.entity.User;
import com.aza.backend.entity.Wallet;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.PromoCodeRedemptionRepository;
import com.aza.backend.repository.PromoCodeRepository;
import com.aza.backend.repository.WalletRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class PromoControllerTest {

    @Autowired PromoController promoController;

    @MockitoBean PromoCodeRepository promoCodeRepository;
    @MockitoBean PromoCodeRedemptionRepository promoCodeRedemptionRepository;
    @MockitoBean WalletRepository walletRepository;
    @MockitoBean StringRedisTemplate stringRedisTemplate;
    @MockitoBean RedisMessageListenerContainer redisMessageListenerContainer;

    private final UUID userId = UUID.randomUUID();

    // ── validate ──────────────────────────────────────────────────────────────

    @Test
    void validate_unknownCode_throwsNotFound() {
        when(promoCodeRepository.findByCodeIgnoreCase("NOTEXIST")).thenReturn(Optional.empty());

        AppException ex = assertThrows(AppException.class,
                () -> promoController.validate("NOTEXIST"));

        assertEquals("PROMO_NOT_FOUND", ex.getCode());
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
    }

    @Test
    void validate_inactiveCode_throwsGone() {
        PromoCode promo = promo("INACTIVE", false, null, null, 0);
        when(promoCodeRepository.findByCodeIgnoreCase("INACTIVE")).thenReturn(Optional.of(promo));

        AppException ex = assertThrows(AppException.class,
                () -> promoController.validate("INACTIVE"));

        assertEquals("PROMO_INACTIVE", ex.getCode());
    }

    @Test
    void validate_expiredCode_throwsGone() {
        PromoCode promo = promo("EXPIRED", true, LocalDateTime.now().minusDays(1), null, 0);
        when(promoCodeRepository.findByCodeIgnoreCase("EXPIRED")).thenReturn(Optional.of(promo));

        AppException ex = assertThrows(AppException.class,
                () -> promoController.validate("EXPIRED"));

        assertEquals("PROMO_EXPIRED", ex.getCode());
    }

    @Test
    void validate_exhaustedCode_throwsGone() {
        PromoCode promo = promo("FULL", true, null, 10, 10);
        when(promoCodeRepository.findByCodeIgnoreCase("FULL")).thenReturn(Optional.of(promo));

        AppException ex = assertThrows(AppException.class,
                () -> promoController.validate("FULL"));

        assertEquals("PROMO_EXHAUSTED", ex.getCode());
    }

    @Test
    void validate_validCode_returnsCodeInfo() {
        PromoCode promo = promo("WELCOME10", true, null, 100, 5);
        when(promoCodeRepository.findByCodeIgnoreCase("WELCOME10")).thenReturn(Optional.of(promo));

        ResponseEntity<?> response = promoController.validate("WELCOME10");

        assertEquals(200, response.getStatusCode().value());
    }

    // ── redeem ────────────────────────────────────────────────────────────────

    @Test
    void redeem_unknownCode_throwsNotFound() {
        when(promoCodeRepository.findByCodeIgnoreCaseForUpdate("GHOST")).thenReturn(Optional.empty());

        AppException ex = assertThrows(AppException.class,
                () -> promoController.redeem(new PromoController.RedeemRequest("GHOST"), activeUser()));

        assertEquals("PROMO_NOT_FOUND", ex.getCode());
    }

    @Test
    void redeem_alreadyRedeemed_throwsConflict() {
        PromoCode promo = promo("ONCE", true, null, null, 0);
        when(promoCodeRepository.findByCodeIgnoreCaseForUpdate("ONCE")).thenReturn(Optional.of(promo));
        when(promoCodeRedemptionRepository.existsByPromoCodeIdAndUserId(promo.getId(), userId))
                .thenReturn(true);

        AppException ex = assertThrows(AppException.class,
                () -> promoController.redeem(new PromoController.RedeemRequest("ONCE"), activeUser()));

        assertEquals("PROMO_ALREADY_REDEEMED", ex.getCode());
        verify(walletRepository, never()).save(any());
    }

    @Test
    void redeem_success_creditsWalletAndSavesRedemption() {
        PromoCode promo = promo("SAVE5", true, null, null, 0);
        promo.setCreditAmountGhs(new BigDecimal("5.00"));
        Wallet wallet = Wallet.builder().userId(userId)
                .balance(new BigDecimal("10.00")).currency("GHS").frozen(false).build();
        when(promoCodeRepository.findByCodeIgnoreCaseForUpdate("SAVE5")).thenReturn(Optional.of(promo));
        when(promoCodeRedemptionRepository.existsByPromoCodeIdAndUserId(promo.getId(), userId))
                .thenReturn(false);
        when(walletRepository.findByUserIdForUpdate(userId)).thenReturn(Optional.of(wallet));

        ResponseEntity<?> response = promoController.redeem(
                new PromoController.RedeemRequest("SAVE5"), activeUser());

        assertEquals(200, response.getStatusCode().value());
        // Balance was credited
        verify(walletRepository).save(argThat(w -> w.getBalance().compareTo(new BigDecimal("15.00")) == 0));
        // Redemption record saved
        verify(promoCodeRedemptionRepository).save(any());
        // Usage counter incremented
        verify(promoCodeRepository).save(argThat(p -> p.getUsedCount() == 1));
    }

    @Test
    void redeem_frozenCode_throwsInactive() {
        PromoCode promo = promo("FROZEN", false, null, null, 0);
        when(promoCodeRepository.findByCodeIgnoreCaseForUpdate("FROZEN")).thenReturn(Optional.of(promo));

        AppException ex = assertThrows(AppException.class,
                () -> promoController.redeem(new PromoController.RedeemRequest("FROZEN"), activeUser()));

        assertEquals("PROMO_INACTIVE", ex.getCode());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private User activeUser() {
        return User.builder()
                .id(userId).email("alice@example.com")
                .status(User.AccountStatus.ACTIVE).kycStatus(User.KycStatus.VERIFIED)
                .build();
    }

    private PromoCode promo(String code, boolean active, LocalDateTime expiresAt,
                            Integer maxUses, int usedCount) {
        PromoCode p = new PromoCode();
        p.setId(UUID.randomUUID());
        p.setCode(code);
        p.setActive(active);
        p.setExpiresAt(expiresAt);
        p.setMaxUses(maxUses);
        p.setUsedCount(usedCount);
        p.setCreditAmountGhs(new BigDecimal("5.00"));
        p.setDescription("Test promo");
        return p;
    }
}
