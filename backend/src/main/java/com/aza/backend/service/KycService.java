package com.aza.backend.service;

import com.aza.backend.dto.kyc.*;
import com.aza.backend.entity.KycRecord;
import com.aza.backend.entity.Notification;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.KycRecordRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.util.CloudinaryService;
import com.aza.backend.util.EmailService;
import org.springframework.http.HttpStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class KycService {

    private final KycRecordRepository kycRecordRepository;
    private final UserRepository userRepository;
    private final CloudinaryService cloudinaryService;
    private final EmailService emailService;
    private final NotificationService notificationService;

    private static final long MAX_DOC_SIZE = 10 * 1024 * 1024; //10MB
    private static final long MAX_IMAGE_SIZE = 5 * 1024 * 1024; //5MB
    private static final List<String> ALLOWED_IMAGE_TYPES = List.of("image/jpeg","image/png");
    private static final List<String> ALLOWED_DOC_TYPES = List.of("image/jpeg", "image/png", "application/pdf");
    private static final Set<String> ALLOWED_FUNDS_SOURCES = Set.of(
            "salary", "savings", "business", "investment", "pension", "gift", "rental", "remittance", "other"
    );
    // Alphanumeric + hyphens only, 4–30 chars — covers all supported ID formats
    private static final java.util.regex.Pattern ID_NUMBER_PATTERN =
            java.util.regex.Pattern.compile("^[A-Z0-9\\-]{4,30}$");

    @Value("${kyc.auto-verify:false}")
    private boolean autoVerify;

    /* Get KYC Status*/
    public KycStatusResponse getStatus(User user) {
        KycRecord record = kycRecordRepository.findByUserId(user.getId()).orElse(null);

        if (record == null) {
            return KycStatusResponse.builder()
                    .status("NOT_STARTED")
                    .completionPercentage(0)
                    .build();
        }

        return getStatusForRecord(record);
    }

    //STEP 1: CONSENT
    @Transactional
    public KycStatusResponse recordConsent(User user, String ipAddress) {
        KycRecord record = getOrCreateRecord(user);

        if (Boolean.TRUE.equals(record.getBiometricConsent())) {
            throw new AppException("Consent already recorded");
        }
        record.setBiometricConsent(true);
        record.setConsentTimestamp(LocalDateTime.now());
        record.setConsentIpAddress(ipAddress);
        kycRecordRepository.save(record);

        updateUserKycStatus(user, User.KycStatus.PENDING);
        return getStatus(user);
    }

    //STEP 2: SOURCE OF FUNDS
    @Transactional
    public KycStatusResponse submitFundsSource(User user, KycFundsSourceRequest request) {
        KycRecord record = getOrCreateRecord(user);
        ensureNotSubmitted(record);

        for (String source : request.getFundsSource().split(",")) {
            String s = source.strip().toLowerCase();
            if (!ALLOWED_FUNDS_SOURCES.contains(s)) {
                throw new AppException("Invalid funds source: \"" + s
                        + "\". Allowed values: " + ALLOWED_FUNDS_SOURCES);
            }
        }

        record.setFundsSource(request.getFundsSource().strip().toLowerCase());
        record.setOtherFundsText(request.getOtherFundsText());
        kycRecordRepository.save(record);
        return getStatus(user);
    }

    //STEP3: ID DOCUMENT
    @Transactional
    public KycStatusResponse submitIdentity(User user, KycIdentityRequest request,
                                             MultipartFile frontImage, MultipartFile backImage) {
        KycRecord record = getOrCreateRecord(user);
        ensureNotSubmitted(record);

        if (request.getIdType() == null || request.getIdType().isBlank()) {
            throw new AppException("ID type is required");
        }
        if (request.getIdNumber() == null || request.getIdNumber().isBlank()) {
            throw new AppException("ID number is required");
        }

        //Validate ID type
        try {
            KycRecord.IdType.valueOf(request.getIdType().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException("Invalid id type");
        }

        //Validate and upload front image
        validateFile(frontImage,MAX_IMAGE_SIZE,ALLOWED_IMAGE_TYPES, "ID front image");
        String frontUrl = cloudinaryService.uploadKycDocument(
                frontImage, user.getId().toString()
        );

        //Validate and upload back image
        validateFile(backImage,MAX_IMAGE_SIZE,ALLOWED_IMAGE_TYPES, "ID back image");
        String backUrl = cloudinaryService.uploadKycDocument(
                backImage, user.getId().toString()
        );

        String idNumber = request.getIdNumber().replaceAll("\\s", "").toUpperCase();
        if (!ID_NUMBER_PATTERN.matcher(idNumber).matches()) {
            throw new AppException("Invalid ID number format. Only letters, digits, and hyphens are accepted (4–30 characters).");
        }

        record.setIdType(KycRecord.IdType.valueOf(request.getIdType().toUpperCase()));
        record.setIdNumber(idNumber);
        record.setIdFrontImageUrl(frontUrl);
        record.setIdBackImageUrl(backUrl);
        kycRecordRepository.save(record);

        return getStatus(user);
    }

    //STEP 4: SELFIE

    @Transactional
    public KycStatusResponse submitSelfie(User user, MultipartFile selfie) {
        KycRecord record = getOrCreateRecord(user);
        ensureNotSubmitted(record);

        validateFile(selfie, MAX_IMAGE_SIZE, ALLOWED_IMAGE_TYPES, "Selfie");

        String selfieUrl = cloudinaryService.uploadKycSelfie(
                selfie, user.getId().toString());

        record.setSelfieImageUrl(selfieUrl);
        kycRecordRepository.save(record);

        return getStatus(user);
    }

    //STEP 5: PEP SCREENING

    @Transactional
    public KycStatusResponse submitPepScreening(User user, KycPepRequest request) {
        KycRecord record = getOrCreateRecord(user);
        ensureNotSubmitted(record);

        record.setIsPep(request.getIsPep());
        if (Boolean.TRUE.equals(request.getIsPep()) && request.getPepStatus() != null) {
            try {
                record.setPepStatus(KycRecord.PepStatus.valueOf(request.getPepStatus().toUpperCase()));
            } catch (IllegalArgumentException e) {
                throw new AppException("Invalid PEP status. Accepted; SELF, FAMILY_ASSOCIATE");
            }
            record.setPepRole(request.getPepRole());
        }
        kycRecordRepository.save(record);
        return getStatus(user);
    }

    //STEP 6: PEP DETAILS
    @Transactional
    public KycStatusResponse submitPepDetails(User user, KycPepDetailsRequest request) {
        KycRecord record = getOrCreateRecord(user);
        ensureNotSubmitted(record);

        if (!Boolean.TRUE.equals(record.getIsPep())) {
            throw new AppException("PEP details only required for Politically Exposed Persons");
        }

        record.setPepAccountPurpose(request.getAccountPurpose());
        record.setPepMonthlyVolume(request.getMonthlyVolume());
        record.setPepWealthSource(request.getWealthSource());
        kycRecordRepository.save(record);

        return getStatus(user);
    }
    //STEP 6b: PROOF OF WEALTH
    @Transactional
    public KycStatusResponse submitProofOfWealth(User user, MultipartFile proofDoc) {
        KycRecord record = getOrCreateRecord(user);
        ensureNotSubmitted(record);

        if (!Boolean.TRUE.equals(record.getIsPep())) {
            throw new AppException("Proof of wealth only required for Politically Exposed Persons");
        }

        validateFile(proofDoc, MAX_DOC_SIZE, ALLOWED_DOC_TYPES, "Proof of wealth document");

        String docUrl = cloudinaryService.uploadKycProofDocument(
                proofDoc, user.getId().toString());

        record.setPepProofDocUrl(docUrl);
        kycRecordRepository.save(record);

        return getStatus(user);
    }

    //STEP 7: SUBMIT
    @Transactional
    public KycStatusResponse submitKyc(User user) {
        KycRecord record = kycRecordRepository.findByUserId(user.getId())
                .orElseThrow(() -> new AppException("No KYC record found — complete all steps first"));

        // Validate all required steps are complete
        if (!Boolean.TRUE.equals(record.getBiometricConsent())) {
            throw new AppException("Step 1 incomplete: biometric consent not given");
        }
        if (record.getFundsSource() == null) {
            throw new AppException("Step 2 incomplete: funds source not submitted");
        }
        if (record.getIdNumber() == null || record.getIdFrontImageUrl() == null) {
            throw new AppException("Step 3 incomplete: ID document not submitted");
        }
        if (record.getSelfieImageUrl() == null) {
            throw new AppException("Step 4 incomplete: selfie not submitted");
        }
        if (record.getIsPep() == null) {
            throw new AppException("Step 5 incomplete: PEP screening not completed");
        }

        // If PEP, ensure EDD details are provided
        if (record.getIsPep()) {
            if (record.getPepAccountPurpose() == null || record.getPepWealthSource() == null) {
                throw new AppException("Step 6 incomplete: PEP enhanced due diligence details required");
            }
        }

        // Prevent re-submission
        if (record.getSubmittedAt() != null) {
            throw new AppException("KYC already submitted. Current status: " + record.getStatus().name());
        }

        record.setSubmittedAt(LocalDateTime.now());

        if (autoVerify) {
            /*
             * ============================================================
             * SIMULATED VERIFICATION (Demo / Final Year Project)
             * ============================================================
             * In production, this is where you would:
             *
             * 1. Call a KYC provider API (e.g., Smile Identity, Onfido, Veriff)
             *    - Send the ID document images for OCR and validation
             *    - Send the selfie for face-match comparison against the ID photo
             *    - Run the user against PEP and sanctions watch lists
             *
             * 2. The provider would return a verification result asynchronously
             *    via a webhook endpoint (POST /api/v1/kyc/webhook)
             *
             * 3. The webhook handler would update the KYC status to
             *    VERIFIED or REJECTED based on the provider's response
             *
             * For this demo, we auto-approve immediately.
             * ============================================================
             */
            record.setStatus(KycRecord.KycStatus.VERIFIED);
            record.setVerifiedAt(LocalDateTime.now());
            record.setVerificationProvider("SIMULATED");
            record.setVerificationReference("DEMO-" + UUID.randomUUID().toString().substring(0, 8));

            log.info("KYC auto-verified for user {} (demo mode)", user.getId());

            updateUserKycStatus(user, User.KycStatus.VERIFIED);
        } else {
            record.setStatus(KycRecord.KycStatus.UNDER_REVIEW);
            updateUserKycStatus(user, User.KycStatus.UNDER_REVIEW);
            emailService.sendKycSubmittedEmail(user.getEmail(), user.getFirstName());
            log.info("KYC submitted for manual review for user {}", user.getId());
        }

        kycRecordRepository.save(record);
        return getStatus(user);
    }

    // ==================== ADMIN METHODS ====================

    public List<KycStatusResponse> getPendingReviews() {
        return kycRecordRepository.findAllByStatus(KycRecord.KycStatus.UNDER_REVIEW)
                .stream()
                .map(record -> {
                    User user = userRepository.findById(record.getUserId()).orElse(null);
                    KycStatusResponse status = getStatusForRecord(record);
                    if (user != null) {
                        status.setDisplayName(user.getFirstName() + " " + user.getLastName());
                        status.setEmail(user.getEmail());
                        status.setUserId(user.getId().toString());
                    }
                    return status;
                })
                .collect(Collectors.toList());
    }

    public KycStatusResponse getKycStatusForAdmin(UUID userId) {
        KycRecord record = kycRecordRepository.findByUserId(userId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "KYC record not found for user", HttpStatus.NOT_FOUND));
        User user = userRepository.findById(userId).orElse(null);
        KycStatusResponse status = getStatusForRecord(record);
        if (user != null) {
            status.setDisplayName(user.getFirstName() + " " + user.getLastName());
            status.setEmail(user.getEmail());
            status.setUserId(user.getId().toString());
        }
        return status;
    }

    @Transactional
    public KycStatusResponse reviewRecord(UUID userId, boolean approve, String rejectionReason) {
        KycRecord record = kycRecordRepository.findByUserId(userId)
                .orElseThrow(() -> new AppException("KYC record not found"));

        if (record.getStatus() != KycRecord.KycStatus.UNDER_REVIEW) {
            throw new AppException("Record is not under review. Current status: " + record.getStatus());
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new AppException("User not found"));

        if (approve) {
            record.setStatus(KycRecord.KycStatus.VERIFIED);
            record.setVerifiedAt(LocalDateTime.now());
            record.setVerificationProvider("MANUAL");
            record.setVerificationReference("ADMIN-" + UUID.randomUUID().toString().substring(0, 8));
            updateUserKycStatus(user, User.KycStatus.VERIFIED);
            log.info("KYC manually approved for user {}", userId);
        } else {
            record.setStatus(KycRecord.KycStatus.REJECTED);
            record.setRejectionReason(rejectionReason);
            // Allow re-submission
            record.setSubmittedAt(null);
            updateUserKycStatus(user, User.KycStatus.REJECTED);
            log.info("KYC manually rejected for user {}. Reason: {}", userId, rejectionReason);
        }

        kycRecordRepository.save(record);

        String name = user.getFirstName() != null ? user.getFirstName() : "User";
        emailService.sendKycStatusEmail(user.getEmail(), name, approve, rejectionReason);

        if (approve) {
            notificationService.sendNotification(
                    user.getId(),
                    Notification.NotificationType.KYC_APPROVED,
                    "Identity Verified",
                    "Your identity has been verified. You can now access all features.",
                    java.util.Map.of("type", "KYC_APPROVED"));
        } else {
            notificationService.sendNotification(
                    user.getId(),
                    Notification.NotificationType.KYC_REJECTED,
                    "Verification Update Required",
                    rejectionReason != null ? rejectionReason : "Your verification was not successful. Please resubmit.",
                    java.util.Map.of("type", "KYC_REJECTED"));
        }

        return getStatus(user);
    }

    private KycStatusResponse getStatusForRecord(KycRecord record) {
        int steps = 0;
        if (Boolean.TRUE.equals(record.getBiometricConsent())) steps++;
        if (record.getFundsSource() != null) steps++;
        if (record.getIdNumber() != null) steps++;
        if (record.getSelfieImageUrl() != null) steps++;
        if (record.getIsPep() != null) steps++;

        int percentage = (steps * 100) / 5;

        return KycStatusResponse.builder()
                .status(record.getStatus().name())
                .completionPercentage(percentage)
                .consentGiven(Boolean.TRUE.equals(record.getBiometricConsent()))
                .fundsSourceSubmitted(record.getFundsSource() != null)
                .idDocumentSubmitted(record.getIdNumber() != null)
                .selfieSubmitted(record.getSelfieImageUrl() != null)
                .pepScreeningDone(record.getIsPep() != null)
                .submitted(record.getSubmittedAt() != null)
                .rejectionReason(record.getRejectionReason())
                .verificationProvider(record.getVerificationProvider())
                .idFrontUrl(record.getIdFrontImageUrl())
                .idBackUrl(record.getIdBackImageUrl())
                .selfieUrl(record.getSelfieImageUrl())
                .idType(record.getIdType() != null ? record.getIdType().name() : null)
                .idNumber(record.getIdNumber())
                .fundsSource(record.getFundsSource())
                .isPep(record.getIsPep())
                .build();
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

    private void ensureNotSubmitted(KycRecord record) {
        if (record.getSubmittedAt() != null) {
            throw new AppException("KYC already submitted — cannot modify. Current status: "
                    + record.getStatus().name());
        }
    }

    private void updateUserKycStatus(User user, User.KycStatus status) {
        user.setKycStatus(status);
        userRepository.save(user);
    }

    private void validateFile(MultipartFile file, long maxSize, List<String> allowedTypes, String fieldName) {
        if (file == null || file.isEmpty()) {
            throw new AppException(fieldName + " is required");
        }
        if (file.getSize() > maxSize) {
            throw new AppException(fieldName + " exceeds maximum size of " + (maxSize / 1024 / 1024) + "MB");
        }
        String contentType = file.getContentType();
        if (contentType == null || !allowedTypes.contains(contentType)) {
            throw new AppException(fieldName + " must be one of: " + String.join(", ", allowedTypes));
        }

        // Validate actual file bytes (magic bytes check)
        try {
            byte[] bytes = file.getBytes();
            if (!isValidFileContent(bytes, allowedTypes)) {
                throw new AppException(fieldName + " content does not match its declared type");
            }
        } catch (java.io.IOException e) {
            throw new AppException("Failed to read " + fieldName);
        }
    }

    private boolean isValidFileContent(byte[] bytes, List<String> allowedTypes) {
        if (bytes.length < 4) return false;

        // JPEG: FF D8 FF
        boolean isJpeg = (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8 && (bytes[2] & 0xFF) == 0xFF;
        // PNG: 89 50 4E 47
        boolean isPng = (bytes[0] & 0xFF) == 0x89 && (bytes[1] & 0xFF) == 0x50
                && (bytes[2] & 0xFF) == 0x4E && (bytes[3] & 0xFF) == 0x47;
        // PDF: 25 50 44 46 (%PDF)
        boolean isPdf = (bytes[0] & 0xFF) == 0x25 && (bytes[1] & 0xFF) == 0x50
                && (bytes[2] & 0xFF) == 0x44 && (bytes[3] & 0xFF) == 0x46;

        if (allowedTypes.contains("image/jpeg") && isJpeg) return true;
        if (allowedTypes.contains("image/png") && isPng) return true;
        return allowedTypes.contains("application/pdf") && isPdf;
    }
}
