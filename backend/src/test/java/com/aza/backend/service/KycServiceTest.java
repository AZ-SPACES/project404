package com.aza.backend.service;

import com.aza.backend.dto.kyc.KycFundsSourceRequest;
import com.aza.backend.dto.kyc.KycStatusResponse;
import com.aza.backend.entity.KycRecord;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.KycRecordRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.util.CloudinaryService;
import com.aza.backend.util.EmailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class KycServiceTest {

    @Autowired KycService kycService;

    @MockitoBean KycRecordRepository kycRecordRepository;
    @MockitoBean UserRepository userRepository;
    @MockitoBean CloudinaryService cloudinaryService;
    @MockitoBean EmailService emailService;
    @MockitoBean NotificationService notificationService;
    @MockitoBean ReferralService referralService;
    @MockitoBean StringRedisTemplate stringRedisTemplate;
    @MockitoBean RedisMessageListenerContainer redisMessageListenerContainer;

    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(kycService, "autoVerify", false);
    }

    // ── getStatus ─────────────────────────────────────────────────────────────

    @Test
    void getStatus_noRecord_returnsNotStarted() {
        when(kycRecordRepository.findByUserId(userId)).thenReturn(Optional.empty());

        KycStatusResponse status = kycService.getStatus(user());

        assertEquals("NOT_STARTED", status.getStatus());
        assertEquals(0, status.getCompletionPercentage());
    }

    @Test
    void getStatus_withRecord_reflectsCompletedSteps() {
        KycRecord record = KycRecord.builder()
                .userId(userId)
                .biometricConsent(true)
                .fundsSource("salary")
                .idNumber("GHA-123456")
                .build();
        when(kycRecordRepository.findByUserId(userId)).thenReturn(Optional.of(record));

        KycStatusResponse status = kycService.getStatus(user());

        assertTrue(status.isConsentGiven());
        assertTrue(status.isFundsSourceSubmitted());
        assertTrue(status.isIdDocumentSubmitted());
    }

    // ── recordConsent ─────────────────────────────────────────────────────────

    @Test
    void recordConsent_alreadyConsentedNotPending_throws() {
        KycRecord record = KycRecord.builder().userId(userId).biometricConsent(true).build();
        record.setStatus(KycRecord.KycStatus.UNDER_REVIEW);
        when(kycRecordRepository.findByUserId(userId)).thenReturn(Optional.of(record));

        assertThrows(AppException.class, () -> kycService.recordConsent(user(), "1.2.3.4"));
    }

    @Test
    void recordConsent_firstTime_savesConsentAndUpdatesUserStatus() {
        KycRecord record = KycRecord.builder().userId(userId).build();
        when(kycRecordRepository.findByUserId(userId)).thenReturn(Optional.of(record));
        when(kycRecordRepository.save(any())).thenReturn(record);

        kycService.recordConsent(user(), "1.2.3.4");

        assertTrue(record.getBiometricConsent());
        assertNotNull(record.getConsentIpAddress());
        verify(userRepository).save(argThat(u -> u.getKycStatus() == User.KycStatus.PENDING));
    }

    // ── submitFundsSource ─────────────────────────────────────────────────────

    @Test
    void submitFundsSource_invalidSource_throws() {
        KycRecord record = KycRecord.builder().userId(userId).build();
        when(kycRecordRepository.findByUserId(userId)).thenReturn(Optional.of(record));

        KycFundsSourceRequest req = new KycFundsSourceRequest();
        req.setFundsSource("lottery_winnings");

        assertThrows(AppException.class, () -> kycService.submitFundsSource(user(), req));
    }

    @Test
    void submitFundsSource_validSource_savesRecord() {
        KycRecord record = KycRecord.builder().userId(userId).build();
        when(kycRecordRepository.findByUserId(userId)).thenReturn(Optional.of(record));
        when(kycRecordRepository.save(any())).thenReturn(record);

        KycFundsSourceRequest req = new KycFundsSourceRequest();
        req.setFundsSource("salary");

        kycService.submitFundsSource(user(), req);

        verify(kycRecordRepository).save(argThat(r -> "salary".equals(r.getFundsSource())));
    }

    // ── submitKyc ─────────────────────────────────────────────────────────────

    @Test
    void submitKyc_noRecord_throws() {
        when(kycRecordRepository.findByUserId(userId)).thenReturn(Optional.empty());

        assertThrows(AppException.class, () -> kycService.submitKyc(user()));
    }

    @Test
    void submitKyc_missingConsent_throws() {
        KycRecord record = KycRecord.builder().userId(userId).build();
        when(kycRecordRepository.findByUserId(userId)).thenReturn(Optional.of(record));

        AppException ex = assertThrows(AppException.class, () -> kycService.submitKyc(user()));

        assertTrue(ex.getMessage().contains("consent"));
    }

    @Test
    void submitKyc_alreadySubmitted_throws() {
        KycRecord record = fullyPopulatedRecord();
        record.setSubmittedAt(java.time.LocalDateTime.now());
        when(kycRecordRepository.findByUserId(userId)).thenReturn(Optional.of(record));

        assertThrows(AppException.class, () -> kycService.submitKyc(user()));
    }

    @Test
    void submitKyc_autoVerifyEnabled_setsVerifiedStatus() {
        ReflectionTestUtils.setField(kycService, "autoVerify", true);
        KycRecord record = fullyPopulatedRecord();
        when(kycRecordRepository.findByUserId(userId)).thenReturn(Optional.of(record));
        when(kycRecordRepository.save(any())).thenReturn(record);

        kycService.submitKyc(user());

        ArgumentCaptor<KycRecord> captor = ArgumentCaptor.forClass(KycRecord.class);
        verify(kycRecordRepository).save(captor.capture());
        assertEquals(KycRecord.KycStatus.VERIFIED, captor.getValue().getStatus());
        verify(userRepository).save(argThat(u -> u.getKycStatus() == User.KycStatus.VERIFIED));
    }

    @Test
    void submitKyc_manualReview_setsUnderReviewStatus() {
        KycRecord record = fullyPopulatedRecord();
        when(kycRecordRepository.findByUserId(userId)).thenReturn(Optional.of(record));
        when(kycRecordRepository.save(any())).thenReturn(record);

        kycService.submitKyc(user());

        ArgumentCaptor<KycRecord> captor = ArgumentCaptor.forClass(KycRecord.class);
        verify(kycRecordRepository).save(captor.capture());
        assertEquals(KycRecord.KycStatus.UNDER_REVIEW, captor.getValue().getStatus());
        verify(emailService).sendKycSubmittedEmail(anyString(), anyString());
    }

    // ── reviewRecord ──────────────────────────────────────────────────────────

    @Test
    void reviewRecord_notUnderReview_throws() {
        KycRecord record = KycRecord.builder().userId(userId).build();
        record.setStatus(KycRecord.KycStatus.VERIFIED);
        when(kycRecordRepository.findByUserId(userId)).thenReturn(Optional.of(record));

        assertThrows(AppException.class, () -> kycService.reviewRecord(userId, true, null));
    }

    @Test
    void reviewRecord_approve_setsVerifiedAndNotifiesUser() {
        KycRecord record = KycRecord.builder().userId(userId).build();
        record.setStatus(KycRecord.KycStatus.UNDER_REVIEW);
        when(kycRecordRepository.findByUserId(userId)).thenReturn(Optional.of(record));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user()));
        when(kycRecordRepository.save(any())).thenReturn(record);

        kycService.reviewRecord(userId, true, null);

        verify(kycRecordRepository).save(argThat(r -> r.getStatus() == KycRecord.KycStatus.VERIFIED));
        verify(userRepository).save(argThat(u -> u.getKycStatus() == User.KycStatus.VERIFIED));
        verify(emailService).sendKycStatusEmail(anyString(), anyString(), eq(true), any());
    }

    @Test
    void reviewRecord_reject_setsRejectedWithReason() {
        KycRecord record = KycRecord.builder().userId(userId).build();
        record.setStatus(KycRecord.KycStatus.UNDER_REVIEW);
        when(kycRecordRepository.findByUserId(userId)).thenReturn(Optional.of(record));
        when(userRepository.findById(userId)).thenReturn(Optional.of(user()));
        when(kycRecordRepository.save(any())).thenReturn(record);

        kycService.reviewRecord(userId, false, "ID document unclear");

        verify(kycRecordRepository).save(argThat(r ->
                r.getStatus() == KycRecord.KycStatus.REJECTED
                && "ID document unclear".equals(r.getRejectionReason())));
    }

    // ── resubmit ──────────────────────────────────────────────────────────────

    @Test
    void resubmit_notRejected_throws() {
        KycRecord record = KycRecord.builder().userId(userId).build();
        record.setStatus(KycRecord.KycStatus.UNDER_REVIEW);
        when(kycRecordRepository.findByUserId(userId)).thenReturn(Optional.of(record));

        assertThrows(AppException.class, () -> kycService.resubmit(user()));
    }

    @Test
    void resubmit_rejected_resetsRecordAndUserStatus() {
        KycRecord record = KycRecord.builder().userId(userId).build();
        record.setStatus(KycRecord.KycStatus.REJECTED);
        record.setRejectionReason("Blurry ID");
        record.setSubmittedAt(java.time.LocalDateTime.now());
        when(kycRecordRepository.findByUserId(userId)).thenReturn(Optional.of(record));
        when(kycRecordRepository.save(any())).thenReturn(record);

        kycService.resubmit(user());

        assertEquals(KycRecord.KycStatus.PENDING, record.getStatus());
        assertNull(record.getRejectionReason());
        assertNull(record.getSubmittedAt());
        verify(userRepository).save(argThat(u -> u.getKycStatus() == User.KycStatus.PENDING));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private User user() {
        return User.builder()
                .id(userId)
                .firstName("Alice")
                .lastName("Smith")
                .email("alice@example.com")
                .status(User.AccountStatus.ACTIVE)
                .kycStatus(User.KycStatus.PENDING)
                .build();
    }

    private KycRecord fullyPopulatedRecord() {
        KycRecord record = KycRecord.builder()
                .userId(userId)
                .biometricConsent(true)
                .fundsSource("salary")
                .idType(KycRecord.IdType.GHANA_CARD)
                .idNumber("GHA-123456789")
                .idFrontImageUrl("https://cdn.example.com/front.jpg")
                .idBackImageUrl("https://cdn.example.com/back.jpg")
                .selfieImageUrl("https://cdn.example.com/selfie.jpg")
                .isPep(false)
                .build();
        record.setStatus(KycRecord.KycStatus.PENDING);
        return record;
    }
}
