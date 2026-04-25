package com.aza.backend.service;

import com.aza.backend.dto.kyc.*;
import com.aza.backend.entity.KycRecord;
import com.aza.backend.entity.User;
import com.aza.backend.repository.KycRecordRepository;
import com.aza.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class KycService {

    private final KycRecordRepository kycRecordRepository;
    private final UserRepository userRepository;

    public KycStatusResponse getStatus(User user) {
        KycRecord record = kycRecordRepository.findByUserId(user.getId()).orElse(null);

        if (record == null) {
            return KycStatusResponse.builder()
                    .status("NOT_STARTED")
                    .completionPercentage(0)
                    .build();
        }

        int steps = 0;
        if (record.getBiometricConsent()) steps++;
        if (record.getFundsSource() != null) steps++;
        if (record.getIdNumber() != null) steps++;
        if (record.getSelfieImageUrl() != null) steps++;
        if (record.getIsPep() != null) steps++;

        int percentage = (steps * 100) / 5;

        return KycStatusResponse.builder()
                .status(record.getStatus().name())
                .completionPercentage(percentage)
                .consentGiven(record.getBiometricConsent())
                .fundsSourceSubmitted(record.getFundsSource() != null)
                .idDocumentSubmitted(record.getIdNumber() != null)
                .selfieSubmitted(record.getSelfieImageUrl() != null)
                .pepScreeningDone(record.getIsPep() != null)
                .submitted(record.getSubmittedAt() != null)
                .build();
    }

    @Transactional
    public KycStatusResponse recordConsent(User user) {
        KycRecord record = getOrCreateRecord(user);
        record.setBiometricConsent(true);
        record.setConsentTimestamp(LocalDateTime.now());
        kycRecordRepository.save(record);

        updateUserKycStatus(user, User.KycStatus.PENDING);
        return getStatus(user);
    }

    @Transactional
    public KycStatusResponse submitFundsSource(User user, KycFundsSourceRequest request) {
        KycRecord record = getOrCreateRecord(user);
        record.setFundsSource(request.getFundsSource());
        record.setOtherFundsText(request.getOtherFundsText());
        kycRecordRepository.save(record);
        return getStatus(user);
    }

    @Transactional
    public KycStatusResponse submitIdentity(User user, KycIdentityRequest request,
                                             String frontImageUrl, String backImageUrl) {
        KycRecord record = getOrCreateRecord(user);
        record.setIdType(KycRecord.IdType.valueOf(request.getIdType().toUpperCase()));
        record.setIdNumber(request.getIdNumber());
        record.setIdFrontImageUrl(frontImageUrl);
        record.setIdBackImageUrl(backImageUrl);
        kycRecordRepository.save(record);
        return getStatus(user);
    }

    @Transactional
    public KycStatusResponse submitSelfie(User user, String selfieUrl) {
        KycRecord record = getOrCreateRecord(user);
        record.setSelfieImageUrl(selfieUrl);
        kycRecordRepository.save(record);
        return getStatus(user);
    }

    @Transactional
    public KycStatusResponse submitPepScreening(User user, KycPepRequest request) {
        KycRecord record = getOrCreateRecord(user);
        record.setIsPep(request.getIsPep());
        if (request.getIsPep() && request.getPepStatus() != null) {
            record.setPepStatus(KycRecord.PepStatus.valueOf(request.getPepStatus().toUpperCase()));
            record.setPepRole(request.getPepRole());
        }
        kycRecordRepository.save(record);
        return getStatus(user);
    }

    @Transactional
    public KycStatusResponse submitKyc(User user) {
        KycRecord record = kycRecordRepository.findByUserId(user.getId())
                .orElseThrow(() -> new RuntimeException("No KYC record found — complete all steps first"));

        if (!record.getBiometricConsent()) throw new RuntimeException("Consent not given");
        if (record.getFundsSource() == null) throw new RuntimeException("Funds source not submitted");
        if (record.getIdNumber() == null) throw new RuntimeException("ID document not submitted");
        if (record.getSelfieImageUrl() == null) throw new RuntimeException("Selfie not submitted");
        if (record.getIsPep() == null) throw new RuntimeException("PEP screening not completed");

        record.setStatus(KycRecord.KycStatus.UNDER_REVIEW);
        record.setSubmittedAt(LocalDateTime.now());
        kycRecordRepository.save(record);

        updateUserKycStatus(user, User.KycStatus.UNDER_REVIEW);
        return getStatus(user);
    }

    // ==================== HELPERS ====================

    private KycRecord getOrCreateRecord(User user) {
        return kycRecordRepository.findByUserId(user.getId())
                .orElseGet(() -> {
                    KycRecord newRecord = KycRecord.builder()
                            .userId(user.getId())
                            .build();
                    return kycRecordRepository.save(newRecord);
                });
    }

    private void updateUserKycStatus(User user, User.KycStatus status) {
        user.setKycStatus(status);
        userRepository.save(user);
    }
}
