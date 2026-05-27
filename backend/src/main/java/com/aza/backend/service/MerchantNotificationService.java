package com.aza.backend.service;

import com.aza.backend.dto.merchant.NotificationPreferenceResponse;
import com.aza.backend.dto.merchant.UpdateNotificationPreferenceRequest;
import com.aza.backend.entity.MerchantNotificationPreference;
import com.aza.backend.repository.MerchantNotificationPreferenceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class MerchantNotificationService {

    private final MerchantNotificationPreferenceRepository preferenceRepository;

    public NotificationPreferenceResponse getPreferences(UUID merchantId) {
        MerchantNotificationPreference pref = preferenceRepository.findByMerchantId(merchantId)
                .orElseGet(() -> {
                    MerchantNotificationPreference defaults = MerchantNotificationPreference.builder()
                            .merchantId(merchantId)
                            .build();
                    return preferenceRepository.save(defaults);
                });
        return toResponse(pref);
    }

    @Transactional
    public NotificationPreferenceResponse updatePreferences(UUID merchantId, UpdateNotificationPreferenceRequest req) {
        MerchantNotificationPreference pref = preferenceRepository.findByMerchantId(merchantId)
                .orElseGet(() -> preferenceRepository.save(
                        MerchantNotificationPreference.builder().merchantId(merchantId).build()));

        if (req.getEmailPaymentReceived() != null) {
            pref.setEmailPaymentReceived(req.getEmailPaymentReceived());
        }
        if (req.getEmailDisputeOpened() != null) {
            pref.setEmailDisputeOpened(req.getEmailDisputeOpened());
        }
        if (req.getEmailPayoutCompleted() != null) {
            pref.setEmailPayoutCompleted(req.getEmailPayoutCompleted());
        }
        if (req.getEmailPayoutFailed() != null) {
            pref.setEmailPayoutFailed(req.getEmailPayoutFailed());
        }
        if (req.getEmailInvoicePaid() != null) {
            pref.setEmailInvoicePaid(req.getEmailInvoicePaid());
        }
        if (req.getEmailWeeklySummary() != null) {
            pref.setEmailWeeklySummary(req.getEmailWeeklySummary());
        }
        if (req.getEmailApiKeyCreated() != null) {
            pref.setEmailApiKeyCreated(req.getEmailApiKeyCreated());
        }
        if (req.getEmailLowBalance() != null) {
            pref.setEmailLowBalance(req.getEmailLowBalance());
        }
        if (req.getLowBalanceThreshold() != null) {
            pref.setLowBalanceThreshold(req.getLowBalanceThreshold());
        }

        pref = preferenceRepository.save(pref);
        log.info("Notification preferences updated for merchantId={}", merchantId);
        return toResponse(pref);
    }

    private NotificationPreferenceResponse toResponse(MerchantNotificationPreference pref) {
        return NotificationPreferenceResponse.builder()
                .emailPaymentReceived(pref.isEmailPaymentReceived())
                .emailDisputeOpened(pref.isEmailDisputeOpened())
                .emailPayoutCompleted(pref.isEmailPayoutCompleted())
                .emailPayoutFailed(pref.isEmailPayoutFailed())
                .emailInvoicePaid(pref.isEmailInvoicePaid())
                .emailWeeklySummary(pref.isEmailWeeklySummary())
                .emailApiKeyCreated(pref.isEmailApiKeyCreated())
                .emailLowBalance(pref.isEmailLowBalance())
                .lowBalanceThreshold(pref.getLowBalanceThreshold())
                .updatedAt(pref.getUpdatedAt())
                .build();
    }
}
