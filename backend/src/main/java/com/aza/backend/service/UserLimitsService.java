package com.aza.backend.service;

import com.aza.backend.dto.admin.UserLimitsPayload;
import com.aza.backend.entity.Notification;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.util.EmailService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Applies custom per-user transaction limits. Extracted from AdminUserController
 * so the maker-checker approval flow can execute it once a second staff member
 * approves; callers should not invoke this directly from request handlers.
 */
@Service
@RequiredArgsConstructor
public class UserLimitsService {

    private final UserRepository userRepository;
    private final SystemSettingService settingService;
    private final NotificationService notificationService;
    private final EmailService emailService;
    private final AdminAuditService auditService;

    @Transactional
    public void applyLimits(User actingAdmin, UUID targetUserId, UserLimitsPayload request) {
        User target = userRepository.findById(targetUserId)
                .orElseThrow(() -> new AppException("User not found"));

        com.aza.backend.dto.admin.SystemSettingsResponse settings = settingService.getSettings();
        BigDecimal prevDaily = target.getCustomDailyLimitGhs() != null
                ? target.getCustomDailyLimitGhs() : settings.getMaxDailyTransferGhs();
        BigDecimal prevSingle = target.getCustomSingleTransactionLimitGhs() != null
                ? target.getCustomSingleTransactionLimitGhs() : settings.getMaxSingleTransactionGhs();

        target.setCustomDailyLimitGhs(request.getDailyLimitGhs());
        target.setCustomSingleTransactionLimitGhs(request.getSingleTransactionLimitGhs());
        userRepository.save(target);

        BigDecimal newDaily = request.getDailyLimitGhs() != null
                ? request.getDailyLimitGhs() : settings.getMaxDailyTransferGhs();
        BigDecimal newSingle = request.getSingleTransactionLimitGhs() != null
                ? request.getSingleTransactionLimitGhs() : settings.getMaxSingleTransactionGhs();

        boolean dailyIncreased = newDaily.compareTo(prevDaily) > 0;
        boolean singleIncreased = newSingle.compareTo(prevSingle) > 0;

        if (dailyIncreased || singleIncreased) {
            String firstName = target.getFirstName() != null ? target.getFirstName() : "there";
            notificationService.sendNotification(
                    target.getId(),
                    Notification.NotificationType.LIMIT_INCREASE,
                    "Your transaction limits have been increased",
                    buildLimitIncreaseBody(dailyIncreased, newDaily, singleIncreased, newSingle),
                    null, null);
            emailService.sendLimitIncreaseEmail(
                    target.getEmail(), firstName,
                    dailyIncreased, newDaily,
                    singleIncreased, newSingle);
        }

        auditService.log(actingAdmin, "UPDATE_TRANSACTION_LIMITS", target,
                "dailyLimit=" + request.getDailyLimitGhs() + " singleLimit=" + request.getSingleTransactionLimitGhs());
    }

    private String buildLimitIncreaseBody(boolean dailyUp, BigDecimal newDaily,
                                          boolean singleUp, BigDecimal newSingle) {
        if (dailyUp && singleUp) {
            return "Your daily limit is now GHS " + newDaily.toPlainString()
                    + " and your single-transaction limit is now GHS " + newSingle.toPlainString() + ".";
        } else if (dailyUp) {
            return "Your daily transfer limit has been increased to GHS " + newDaily.toPlainString() + ".";
        } else {
            return "Your single-transaction limit has been increased to GHS " + newSingle.toPlainString() + ".";
        }
    }
}
