package com.aza.backend.service;

import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.MerchantNotificationPreference;
import com.aza.backend.repository.MerchantNotificationPreferenceRepository;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.repository.TransactionRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.util.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class MerchantAlertService {

    private final MerchantNotificationPreferenceRepository notificationPrefRepository;
    private final MerchantRepository merchantRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final TransactionRepository transactionRepository;

    @Scheduled(cron = "0 0 8 * * *", zone = "Africa/Accra")
    public void checkLowBalanceAlerts() {
        List<MerchantNotificationPreference> prefs = notificationPrefRepository.findByEmailLowBalanceTrue();
        int sent = 0;

        for (MerchantNotificationPreference pref : prefs) {
            if (pref.getLowBalanceThreshold() == null) continue;

            Merchant merchant = merchantRepository.findById(pref.getMerchantId()).orElse(null);
            if (merchant == null || merchant.getStatus() != Merchant.MerchantStatus.ACTIVE) continue;

            BigDecimal balance = merchant.getBalance() != null ? merchant.getBalance() : BigDecimal.ZERO;
            if (balance.compareTo(pref.getLowBalanceThreshold()) <= 0) {
                userRepository.findById(merchant.getUserId()).ifPresent(owner -> {
                    emailService.sendMerchantLowBalanceAlert(
                            owner.getEmail(), owner.getFirstName(),
                            merchant.getBusinessName(), balance, pref.getLowBalanceThreshold());
                });
                sent++;
            }
        }

        if (sent > 0) {
            log.info("Low balance alerts sent to {} merchant(s)", sent);
        }
    }

    @Scheduled(cron = "0 0 9 * * SUN", zone = "Africa/Accra")
    public void sendWeeklySummaries() {
        List<MerchantNotificationPreference> prefs = notificationPrefRepository.findByEmailWeeklySummaryTrue();

        LocalDateTime end = LocalDate.now().atStartOfDay();
        LocalDateTime start = end.minusDays(7);
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("MMM d");
        DateTimeFormatter fmtYear = DateTimeFormatter.ofPattern("MMM d, yyyy");
        String weekRange = start.format(fmt) + " – " + end.minusDays(1).format(fmtYear);

        int sent = 0;
        for (MerchantNotificationPreference pref : prefs) {
            Merchant merchant = merchantRepository.findById(pref.getMerchantId()).orElse(null);
            if (merchant == null || merchant.getStatus() != Merchant.MerchantStatus.ACTIVE) continue;

            BigDecimal revenue = transactionRepository.getTotalReceivedBetween(merchant.getUserId(), start, end);
            long txnCount = transactionRepository.countReceivedBetween(merchant.getUserId(), start, end);
            BigDecimal balance = merchant.getBalance() != null ? merchant.getBalance() : BigDecimal.ZERO;

            userRepository.findById(merchant.getUserId()).ifPresent(owner ->
                    emailService.sendMerchantWeeklySummaryEmail(
                            owner.getEmail(), owner.getFirstName(),
                            merchant.getBusinessName(), revenue, txnCount, balance, weekRange));
            sent++;
        }

        if (sent > 0) {
            log.info("Weekly summary emails sent to {} merchant(s)", sent);
        }
    }
}
