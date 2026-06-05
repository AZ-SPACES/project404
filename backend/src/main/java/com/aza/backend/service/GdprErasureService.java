package com.aza.backend.service;

import com.aza.backend.entity.AuditLog;
import com.aza.backend.entity.KycRecord;
import com.aza.backend.entity.User;
import com.aza.backend.repository.*;
import com.aza.backend.repository.UserKeyBundleRepository;
import com.aza.backend.util.CloudinaryService;
import com.aza.backend.util.EmailService;
import com.aza.backend.util.SmsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Executes GDPR right-to-erasure for a user whose 30-day grace period has elapsed.
 *
 * Retention policy (Bank of Ghana):
 *   - Financial records (transactions, audit_logs, generated_statements) are RETAINED
 *     for 7 years as required by BoG AML/CFT and data-protection regulations.
 *   - All PII and security credentials are erased; unique constraint columns are
 *     replaced with opaque placeholders so the slot can be re-registered later.
 *   - KYC record row is retained (BoG requirement) but image URLs are deleted from
 *     Cloudinary and nulled.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GdprErasureService {

    private final UserRepository userRepository;
    private final UserKeyBundleRepository userKeyBundleRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final BiometricTokenRepository biometricTokenRepository;
    private final FcmTokenRepository fcmTokenRepository;
    private final RecoveryCodeRepository recoveryCodeRepository;
    private final AccountRecoveryContactRepository recoveryContactRepository;
    private final ContactRepository contactRepository;
    private final NotificationRepository notificationRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final KycRecordRepository kycRecordRepository;
    private final CloudinaryService cloudinaryService;
    private final EmailService emailService;
    private final SmsService smsService;
    private final AuditService auditService;

    @Transactional
    public void erase(UUID userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) {
            log.warn("GDPR erasure: user {} not found", userId);
            return;
        }

        // Capture PII before wiping — needed for confirmation notifications
        String email = user.getEmail();
        String phone = user.getPhoneNumber();
        String firstName = user.getFirstName();

        log.info("GDPR erasure starting for user {}", userId);

        // ── 1. Delete Cloudinary assets ───────────────────────────────────────
        cloudinaryService.deleteByUrl(user.getProfileImageUrl());

        kycRecordRepository.findByUserId(userId).ifPresent(kyc -> {
            cloudinaryService.deleteByUrl(kyc.getSelfieImageUrl());
            cloudinaryService.deleteByUrl(kyc.getIdFrontImageUrl());
            cloudinaryService.deleteByUrl(kyc.getIdBackImageUrl());
            cloudinaryService.deleteByUrl(kyc.getPepProofDocUrl());
            // Null the URLs but keep the KYC row (BoG retention requirement)
            kyc.setSelfieImageUrl(null);
            kyc.setIdFrontImageUrl(null);
            kyc.setIdBackImageUrl(null);
            kyc.setPepProofDocUrl(null);
            kycRecordRepository.save(kyc);
        });

        // ── 2. Scrub PII from users row ───────────────────────────────────────
        // Replace unique-constraint columns with opaque placeholders
        user.setEmail("deleted-" + userId + "@aza.invalid");
        user.setPhoneNumber("DELETED-" + userId.toString().replace("-", "").substring(0, 16));
        user.setUsername(null);

        user.setFirstName(null);
        user.setLastName(null);
        user.setDateOfBirth(null);
        user.setProfileImageUrl(null);
        user.setHomeAddress(null);
        user.setCity(null);
        user.setNationality(null);
        user.setOtherNationality(null);
        user.setTaxCountry(null);
        user.setPronouns(null);
        user.setHomeBackground(null);
        user.setHubBackground(null);
        user.setNotificationPreferences(null);

        // Wipe all security credentials
        user.setPasswordHash("ERASED");
        user.setPasscodeHash(null);
        user.setTwoFactorSecret(null);

        // Wipe all device E2EE key bundles
        userKeyBundleRepository.deleteAll(userKeyBundleRepository.findByUserId(user.getId()));

        user.setStatus(User.AccountStatus.DEACTIVATED);
        user.setScheduledDeletionAt(null);
        user.setDeletedAt(LocalDateTime.now());
        userRepository.save(user);

        // ── 3. Hard-delete non-financial rows ─────────────────────────────────
        refreshTokenRepository.deleteAllByUserId(userId);
        biometricTokenRepository.deleteAllByUserId(userId);
        fcmTokenRepository.deleteAllByUserId(userId);
        recoveryCodeRepository.deleteAllByUserId(userId);
        recoveryContactRepository.deleteAllByUserIdOrContactUserId(userId);
        contactRepository.deleteAllByOwnerUserId(userId);
        notificationRepository.deleteAllByUserId(userId);

        // ── 4. Wipe E2EE message content (retain metadata for BoG) ───────────
        chatMessageRepository.wipeSenderMessageContent(userId);

        // ── 5. Audit ──────────────────────────────────────────────────────────
        auditService.logWithDetails("GDPR_ERASURE_COMPLETED", AuditLog.SUCCESS,
                userId, null, null,
                "{\"retainedFor\":\"BoG 7-year financial record requirement\"}");

        // ── 6. Send confirmation notifications ───────────────────────────────
        emailService.sendDeletionCompletedEmail(email, firstName);
        if (phone != null && !phone.isBlank()) {
            smsService.sendDeletionCompletedSms(phone);
        }

        log.info("GDPR erasure completed for user {}", userId);
    }
}
