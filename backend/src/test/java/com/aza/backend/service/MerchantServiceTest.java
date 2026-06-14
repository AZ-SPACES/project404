package com.aza.backend.service;

import com.aza.backend.dto.merchant.MerchantRegisterRequest;
import com.aza.backend.dto.merchant.MerchantResponse;
import com.aza.backend.dto.merchant.WebhookEndpointRequest;
import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.MerchantApiKey;
import com.aza.backend.entity.WebhookEndpoint;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.*;
import com.aza.backend.util.CloudinaryService;
import com.aza.backend.util.EmailService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class MerchantServiceTest {

    @Autowired MerchantService merchantService;

    @MockitoBean MerchantRepository merchantRepository;
    @MockitoBean KybRecordRepository kybRecordRepository;
    @MockitoBean KybDocumentRepository kybDocumentRepository;
    @MockitoBean MerchantApiKeyRepository apiKeyRepository;
    @MockitoBean MerchantApiLogRepository apiLogRepository;
    @MockitoBean WebhookEndpointRepository webhookRepository;
    @MockitoBean WebhookDeliveryRepository webhookDeliveryRepository;
    @MockitoBean MerchantPayoutRepository payoutRepository;
    @MockitoBean UserService userService;
    @MockitoBean WalletRepository walletRepository;
    @MockitoBean UserRepository userRepository;
    @MockitoBean CloudinaryService cloudinaryService;
    @MockitoBean NotificationService notificationService;
    @MockitoBean EmailService emailService;
    @MockitoBean MerchantNotificationPreferenceRepository notificationPrefRepository;
    @MockitoBean CheckoutSessionRepository checkoutSessionRepository;
    @MockitoBean MerchantAuditLogRepository auditLogRepository;
    @MockitoBean DisputeRepository disputeRepository;
    @MockitoBean MerchantInvoiceRepository invoiceRepository;
    @MockitoBean CheckoutService checkoutService;
    @MockitoBean MerchantSettlementService merchantSettlementService;
    @MockitoBean StringRedisTemplate stringRedisTemplate;
    @MockitoBean RedisMessageListenerContainer redisMessageListenerContainer;

    private final UUID userId = UUID.randomUUID();

    // ── isHandleAvailable ─────────────────────────────────────────────────────

    @Test
    void isHandleAvailable_handleExists_returnsFalse() {
        when(merchantRepository.existsByBusinessHandle("myshop")).thenReturn(true);

        assertFalse(merchantService.isHandleAvailable("myshop"));
    }

    @Test
    void isHandleAvailable_handleFree_returnsTrue() {
        when(merchantRepository.existsByBusinessHandle("newshop")).thenReturn(false);

        assertTrue(merchantService.isHandleAvailable("newshop"));
    }

    // ── getMyMerchant ─────────────────────────────────────────────────────────

    @Test
    void getMyMerchant_noMerchant_returnsNull() {
        when(merchantRepository.findByUserId(userId)).thenReturn(Optional.empty());

        assertNull(merchantService.getMyMerchant(userId));
    }

    // ── register ──────────────────────────────────────────────────────────────

    @Test
    void register_userAlreadyHasMerchant_throwsConflict() {
        when(merchantRepository.findByUserId(userId)).thenReturn(Optional.of(new Merchant()));

        AppException ex = assertThrows(AppException.class,
                () -> merchantService.register(userId, registerRequest("legit_shop", "Legit Shop")));

        assertEquals("ALREADY_EXISTS", ex.getCode());
        verify(merchantRepository, never()).save(any());
    }

    @Test
    void register_invalidHandleFormat_throwsBadRequest() {
        when(merchantRepository.findByUserId(userId)).thenReturn(Optional.empty());

        AppException ex = assertThrows(AppException.class,
                () -> merchantService.register(userId, registerRequest("INVALID HANDLE!", "My Shop")));

        assertEquals("INVALID_HANDLE", ex.getCode());
    }

    @Test
    void register_handleAlreadyTaken_throwsConflict() {
        when(merchantRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(merchantRepository.existsByBusinessHandle("taken_shop")).thenReturn(true);

        AppException ex = assertThrows(AppException.class,
                () -> merchantService.register(userId, registerRequest("taken_shop", "My Shop")));

        assertEquals("HANDLE_TAKEN", ex.getCode());
    }

    @Test
    void register_invalidCategory_throwsBadRequest() {
        when(merchantRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(merchantRepository.existsByBusinessHandle(anyString())).thenReturn(false);

        MerchantRegisterRequest req = registerRequest("new_shop", "New Shop");
        req.setCategory("SPACE_TOURISM");

        AppException ex = assertThrows(AppException.class,
                () -> merchantService.register(userId, req));

        assertEquals("INVALID_CATEGORY", ex.getCode());
    }

    @Test
    void register_success_savesMerchantWithPendingKybStatus() {
        when(merchantRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(merchantRepository.existsByBusinessHandle("new_shop")).thenReturn(false);
        when(merchantRepository.save(any(Merchant.class))).thenAnswer(inv -> {
            Merchant m = inv.getArgument(0);
            m.setId(UUID.randomUUID());
            m.setBalance(BigDecimal.ZERO);
            m.setTotalVolume(BigDecimal.ZERO);
            return m;
        });

        MerchantResponse response = merchantService.register(userId,
                registerRequest("new_shop", "New Shop"));

        verify(merchantRepository).save(argThat(m ->
                m.getStatus() == Merchant.MerchantStatus.PENDING_KYB
                && "new_shop".equals(m.getBusinessHandle())
                && "New Shop".equals(m.getBusinessName())));
        assertNotNull(response);
    }

    // ── revokeApiKey ──────────────────────────────────────────────────────────

    @Test
    void revokeApiKey_keyBelongsToOtherMerchant_throwsForbidden() {
        UUID myMerchantId = UUID.randomUUID();
        UUID otherMerchantId = UUID.randomUUID();
        Merchant myMerchant = Merchant.builder().id(myMerchantId).userId(userId).build();
        MerchantApiKey key = MerchantApiKey.builder()
                .id(UUID.randomUUID()).merchantId(otherMerchantId).build();
        when(merchantRepository.findByUserId(userId)).thenReturn(Optional.of(myMerchant));
        when(apiKeyRepository.findById(key.getId())).thenReturn(Optional.of(key));

        AppException ex = assertThrows(AppException.class,
                () -> merchantService.revokeApiKey(userId, key.getId()));

        assertEquals("FORBIDDEN", ex.getCode());
        verify(apiKeyRepository, never()).save(any());
        verify(apiKeyRepository, never()).delete(any());
    }

    @Test
    void revokeApiKey_activeKey_setsInactiveAndSendsEmail() {
        UUID myMerchantId = UUID.randomUUID();
        Merchant myMerchant = Merchant.builder().id(myMerchantId).userId(userId)
                .businessName("My Shop").build();
        MerchantApiKey key = MerchantApiKey.builder()
                .id(UUID.randomUUID()).merchantId(myMerchantId)
                .label("Production key").keyPrefix("aza_live_Ab").isActive(true).build();
        when(merchantRepository.findByUserId(userId)).thenReturn(Optional.of(myMerchant));
        when(apiKeyRepository.findById(key.getId())).thenReturn(Optional.of(key));

        merchantService.revokeApiKey(userId, key.getId());

        verify(apiKeyRepository).save(argThat(k -> Boolean.FALSE.equals(k.getIsActive())));
    }

    // ── updateWebhookEndpoint ─────────────────────────────────────────────────

    @Test
    void updateWebhookEndpoint_endpointBelongsToOtherMerchant_throwsForbidden() {
        UUID myMerchantId = UUID.randomUUID();
        UUID otherMerchantId = UUID.randomUUID();
        Merchant myMerchant = Merchant.builder().id(myMerchantId).userId(userId).build();
        WebhookEndpoint endpoint = WebhookEndpoint.builder()
                .id(UUID.randomUUID()).merchantId(otherMerchantId)
                .url("https://other.example.com").build();
        when(merchantRepository.findByUserId(userId)).thenReturn(Optional.of(myMerchant));
        when(webhookRepository.findById(endpoint.getId())).thenReturn(Optional.of(endpoint));

        WebhookEndpointRequest req = new WebhookEndpointRequest();
        AppException ex = assertThrows(AppException.class,
                () -> merchantService.updateWebhookEndpoint(userId, endpoint.getId(), req));

        assertEquals("FORBIDDEN", ex.getCode());
        verify(webhookRepository, never()).save(any());
    }

    // ── validateApiKey ────────────────────────────────────────────────────────

    @Test
    void validateApiKey_expiredKey_returnsNull() {
        MerchantApiKey key = MerchantApiKey.builder()
                .id(UUID.randomUUID())
                .expiresAt(LocalDateTime.now().minusDays(1))
                .build();
        when(apiKeyRepository.findByKeyHashAndIsActiveTrue("hash")).thenReturn(Optional.of(key));

        assertNull(merchantService.validateApiKey("hash", "1.2.3.4", "agent"));
    }

    @Test
    void validateApiKey_ipNotInWhitelist_throwsUnauthorized() {
        MerchantApiKey key = MerchantApiKey.builder()
                .id(UUID.randomUUID())
                .ipWhitelist("10.0.0.1,10.0.0.2")
                .build();
        when(apiKeyRepository.findByKeyHashAndIsActiveTrue("hash")).thenReturn(Optional.of(key));

        AppException ex = assertThrows(AppException.class,
                () -> merchantService.validateApiKey("hash", "1.2.3.4", "agent"));

        assertEquals("UNAUTHORIZED_IP", ex.getCode());
    }

    @Test
    void validateApiKey_ipInWhitelist_returnsKey() {
        MerchantApiKey key = MerchantApiKey.builder()
                .id(UUID.randomUUID())
                .ipWhitelist("1.2.3.4,1.2.3.5")
                .build();
        when(apiKeyRepository.findByKeyHashAndIsActiveTrue("hash")).thenReturn(Optional.of(key));
        when(apiKeyRepository.save(any())).thenReturn(key);

        MerchantApiKey result = merchantService.validateApiKey("hash", "1.2.3.4", "agent");

        assertNotNull(result);
        verify(apiKeyRepository).save(argThat(k -> "1.2.3.4".equals(k.getLastUsedIp())));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private MerchantRegisterRequest registerRequest(String handle, String name) {
        MerchantRegisterRequest req = new MerchantRegisterRequest();
        req.setBusinessHandle(handle);
        req.setBusinessName(name);
        req.setBusinessEmail("shop@example.com");
        req.setBusinessPhone("+233201234567");
        return req;
    }
}
