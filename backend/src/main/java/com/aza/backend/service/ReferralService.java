package com.aza.backend.service;

import com.aza.backend.entity.Notification;
import com.aza.backend.entity.Referral;
import com.aza.backend.entity.User;
import com.aza.backend.entity.Wallet;
import com.aza.backend.repository.ReferralRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReferralService {

    private final ReferralRepository referralRepository;
    private final UserRepository userRepository;
    private final WalletRepository walletRepository;
    private final NotificationService notificationService;

    @Value("${app.referral.reward-ghs:10.00}")
    private BigDecimal rewardAmountGhs;

    private static final String CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous I/O/0/1
    private static final SecureRandom RNG = new SecureRandom();

    /** Generate a unique 8-character alphanumeric referral code for a new user. */
    public String generateCode() {
        String code;
        do {
            StringBuilder sb = new StringBuilder(8);
            for (int i = 0; i < 8; i++) sb.append(CHARS.charAt(RNG.nextInt(CHARS.length())));
            code = sb.toString();
        } while (userRepository.findByReferralCode(code).isPresent());
        return code;
    }

    /**
     * Called during signup when the user provides a referral code.
     * Creates a PENDING referral row; the referrer is rewarded once the new user completes KYC.
     */
    @Transactional
    public Optional<Referral> applyReferral(User newUser, String code) {
        if (code == null || code.isBlank()) return Optional.empty();
        Optional<User> referrerOpt = userRepository.findByReferralCode(code.toUpperCase().trim());
        if (referrerOpt.isEmpty()) {
            log.debug("Referral code {} not found — ignored during signup", code);
            return Optional.empty();
        }
        User referrer = referrerOpt.get();
        if (referrer.getId().equals(newUser.getId())) return Optional.empty(); // self-referral
        if (referralRepository.existsByReferredUserId(newUser.getId())) return Optional.empty();

        Referral referral = Referral.builder()
                .referrerId(referrer.getId())
                .referredUserId(newUser.getId())
                .code(code.toUpperCase().trim())
                .rewardAmount(rewardAmountGhs)
                .build();
        return Optional.of(referralRepository.save(referral));
    }

    /**
     * Called when a referred user's KYC is approved — credit the referrer's wallet
     * and mark the referral REWARDED.
     */
    @Transactional
    public void rewardReferrer(UUID referredUserId) {
        referralRepository.findByReferredUserId(referredUserId).ifPresent(referral -> {
            if (referral.getStatus() != Referral.Status.PENDING) return;

            walletRepository.findByUserId(referral.getReferrerId()).ifPresent(wallet -> {
                wallet.setBalance(wallet.getBalance().add(referral.getRewardAmount()));
                walletRepository.save(wallet);
            });

            referral.setStatus(Referral.Status.REWARDED);
            referral.setRewardedAt(LocalDateTime.now());
            referralRepository.save(referral);

            notificationService.sendNotification(
                    referral.getReferrerId(),
                    Notification.NotificationType.MONEY_RECEIVED,
                    "Referral Reward!",
                    "Your friend joined AZA using your invite code. GHS "
                            + referral.getRewardAmount().toPlainString() + " has been added to your wallet.",
                    Map.of("type", "referral_reward", "amount", referral.getRewardAmount().toPlainString())
            );

            log.info("Referral rewarded: referrer={}, reward=GHS {}",
                    referral.getReferrerId(), referral.getRewardAmount());
        });
    }

    public Page<Referral> listAll(int page, int size) {
        return referralRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(page, size));
    }

    public Map<String, Object> stats() {
        long total = referralRepository.count();
        long rewarded = referralRepository.countRewarded();
        BigDecimal totalRewards = referralRepository.totalRewardsGiven();
        return Map.of(
                "total", total,
                "rewarded", rewarded,
                "pending", total - rewarded,
                "totalRewardsGhs", totalRewards
        );
    }
}
