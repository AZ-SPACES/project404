package com.aza.backend.scheduler;

import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.MerchantPayout;
import com.aza.backend.repository.MerchantPayoutRepository;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.service.WalletLedger;
import com.aza.backend.service.WalletLocker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class AutoPayoutScheduler {

    private final MerchantRepository merchantRepository;
    private final WalletLedger walletLedger;
    private final MerchantPayoutRepository merchantPayoutRepository;

    private static final BigDecimal MINIMUM_PAYOUT = new BigDecimal("1.00");

    @Scheduled(cron = "0 0 6 * * *") // 6am every day
    @Transactional
    public void processAutoPayouts() {
        log.info("Auto-payout job started");

        List<Merchant> eligibleMerchants = merchantRepository.findAllAutoPayoutEligible();
        log.info("Found {} auto-payout eligible merchants", eligibleMerchants.size());

        LocalDate today = LocalDate.now();

        for (Merchant merchant : eligibleMerchants) {
            try {
                processAutoPayoutForMerchant(merchant, today);
            } catch (Exception e) {
                log.error("Auto-payout failed for merchantId={}: {}", merchant.getId(), e.getMessage(), e);
            }
        }

        log.info("Auto-payout job completed");
    }

    private void processAutoPayoutForMerchant(Merchant merchant, LocalDate today) {
        // Check if today matches their schedule
        if (!shouldFireToday(merchant, today)) {
            return;
        }

        // Determine the minimum balance threshold
        BigDecimal minBalance = merchant.getAutoPayoutMinBalance() != null
                ? merchant.getAutoPayoutMinBalance()
                : MINIMUM_PAYOUT;

        // Pre-check balance (non-locking read)
        if (merchant.getBalance().compareTo(minBalance) < 0) {
            log.debug("Auto-payout skipped for merchantId={}: balance {} below threshold {}",
                    merchant.getId(), merchant.getBalance(), minBalance);
            return;
        }

        // Pessimistic lock to prevent concurrent payouts
        Merchant locked = merchantRepository.findByIdForUpdate(merchant.getId()).orElse(null);
        if (locked == null) {
            log.warn("Auto-payout: merchant not found after lock for merchantId={}", merchant.getId());
            return;
        }

        // Re-check balance after acquiring lock
        if (locked.getBalance().compareTo(minBalance) < 0) {
            log.debug("Auto-payout skipped after re-check for merchantId={}: balance {} below threshold {}",
                    locked.getId(), locked.getBalance(), minBalance);
            return;
        }

        BigDecimal payoutAmount = locked.getBalance();

        // Credit first, debit second. The merchant row is already locked above, so the
        // lock order stays merchant-then-wallet and still matches MerchantService.requestPayout.
        //
        // The order of the *writes* matters on its own: this previously zeroed the merchant
        // balance, then logged a warning and carried on when the owner's wallet was missing,
        // writing a COMPLETED payout for money that had been credited to nobody. Crediting
        // first means a missing wallet throws before anything is debited, and the caller's
        // per-merchant catch skips this merchant with its balance intact.
        walletLedger.credit(
                WalletLocker.personal(locked.getUserId(), "No personal wallet for merchant owner"),
                payoutAmount);

        locked.setBalance(BigDecimal.ZERO);
        merchantRepository.save(locked);

        // Create the payout record
        MerchantPayout payout = MerchantPayout.builder()
                .merchantId(locked.getId())
                .amount(payoutAmount)
                .status(MerchantPayout.PayoutStatus.COMPLETED)
                .note("Auto-payout")
                .completedAt(LocalDateTime.now())
                .build();

        merchantPayoutRepository.save(payout);

        log.info("Auto-payout completed: merchantId={}, amount={}, payoutId={}",
                locked.getId(), payoutAmount, payout.getId());
    }

    /**
     * Determines whether the auto-payout should fire today based on the merchant's schedule.
     * DAILY:   always fires
     * WEEKLY:  fires when today's ISO day-of-week value matches autoPayoutDay (1=Monday, 7=Sunday)
     * MONTHLY: fires when today's day-of-month matches autoPayoutDay; if the configured day exceeds
     *          the month's actual length, fire on the last day of the month instead
     */
    private boolean shouldFireToday(Merchant merchant, LocalDate today) {
        if (merchant.getAutoPayoutSchedule() == null) {
            return false;
        }

        return switch (merchant.getAutoPayoutSchedule()) {
            case DAILY -> true;
            case WEEKLY -> {
                if (merchant.getAutoPayoutDay() == null) yield false;
                yield today.getDayOfWeek().getValue() == merchant.getAutoPayoutDay();
            }
            case MONTHLY -> {
                if (merchant.getAutoPayoutDay() == null) yield false;
                int configuredDay = merchant.getAutoPayoutDay();
                int monthLength = today.lengthOfMonth();
                // Fire on last day of month if configured day exceeds month length
                int effectiveDay = Math.min(configuredDay, monthLength);
                yield today.getDayOfMonth() == effectiveDay;
            }
        };
    }
}
