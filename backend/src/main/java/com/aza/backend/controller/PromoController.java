package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.entity.PromoCode;
import com.aza.backend.entity.PromoCodeRedemption;
import com.aza.backend.entity.User;
import com.aza.backend.entity.Wallet;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.PromoCodeRedemptionRepository;
import com.aza.backend.repository.PromoCodeRepository;
import com.aza.backend.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/promos")
@RequiredArgsConstructor
public class PromoController {

    private final PromoCodeRepository promoCodeRepository;
    private final PromoCodeRedemptionRepository promoCodeRedemptionRepository;
    private final WalletRepository walletRepository;

    @GetMapping("/validate")
    public ResponseEntity<?> validate(@RequestParam String code) {
        PromoCode promo = promoCodeRepository.findByCodeIgnoreCase(code.trim())
                .orElseThrow(() -> new AppException("PROMO_NOT_FOUND", "Invalid promo code", HttpStatus.NOT_FOUND));

        if (!promo.isActive()) {
            throw new AppException("PROMO_INACTIVE", "This promo code is no longer active", HttpStatus.GONE);
        }
        if (promo.getExpiresAt() != null && promo.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new AppException("PROMO_EXPIRED", "This promo code has expired", HttpStatus.GONE);
        }
        if (promo.getMaxUses() != null && promo.getUsedCount() >= promo.getMaxUses()) {
            throw new AppException("PROMO_EXHAUSTED", "Promo code usage limit reached", HttpStatus.GONE);
        }

        Map<String, Object> info = new LinkedHashMap<>();
        info.put("code", promo.getCode());
        info.put("description", promo.getDescription());
        info.put("creditAmountGhs", promo.getCreditAmountGhs());

        return ResponseEntity.ok(ApiResponse.success(info));
    }

    record RedeemRequest(String code) {}

    @PostMapping("/redeem")
    @Transactional
    public ResponseEntity<?> redeem(
            @RequestBody RedeemRequest req,
            @AuthenticationPrincipal User user) {

        PromoCode promo = promoCodeRepository.findByCodeIgnoreCase(req.code().trim())
                .orElseThrow(() -> new AppException("PROMO_NOT_FOUND", "Invalid promo code", HttpStatus.NOT_FOUND));

        if (!promo.isActive()) {
            throw new AppException("PROMO_INACTIVE", "This promo code is no longer active", HttpStatus.GONE);
        }
        if (promo.getExpiresAt() != null && promo.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new AppException("PROMO_EXPIRED", "This promo code has expired", HttpStatus.GONE);
        }
        if (promo.getMaxUses() != null && promo.getUsedCount() >= promo.getMaxUses()) {
            throw new AppException("PROMO_EXHAUSTED", "Promo code usage limit reached", HttpStatus.GONE);
        }
        if (promoCodeRedemptionRepository.existsByPromoCodeIdAndUserId(promo.getId(), user.getId())) {
            throw new AppException("PROMO_ALREADY_REDEEMED", "You have already redeemed this promo code", HttpStatus.CONFLICT);
        }

        Wallet wallet = walletRepository.findByUserIdForUpdate(user.getId())
                .orElseThrow(() -> new AppException("WALLET_NOT_FOUND", "Wallet not found", HttpStatus.NOT_FOUND));
        wallet.setBalance(wallet.getBalance().add(promo.getCreditAmountGhs()));
        walletRepository.save(wallet);

        promoCodeRedemptionRepository.save(PromoCodeRedemption.builder()
                .promoCodeId(promo.getId())
                .userId(user.getId())
                .creditAmountGhs(promo.getCreditAmountGhs())
                .build());

        promo.setUsedCount(promo.getUsedCount() + 1);
        promoCodeRepository.save(promo);

        return ResponseEntity.ok(ApiResponse.success(Map.of("credited", promo.getCreditAmountGhs())));
    }
}
