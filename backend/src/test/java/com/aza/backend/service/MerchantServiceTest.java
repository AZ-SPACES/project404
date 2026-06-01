package com.aza.backend.service;

import com.aza.backend.dto.merchant.MerchantRegisterRequest;
import com.aza.backend.dto.merchant.MerchantResponse;
import com.aza.backend.entity.Merchant;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.*;
import com.aza.backend.util.CloudinaryService;
import com.aza.backend.util.EmailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MerchantServiceTest {

    private MerchantService merchantService;

    @Mock private MerchantRepository merchantRepository;
    @Mock private KybRecordRepository kybRecordRepository;
    @Mock private KybDocumentRepository kybDocumentRepository;
    @Mock private MerchantApiKeyRepository apiKeyRepository;
    @Mock private MerchantApiLogRepository apiLogRepository;
    @Mock private WebhookEndpointRepository webhookRepository;
    @Mock private WebhookDeliveryRepository webhookDeliveryRepository;
    @Mock private MerchantPayoutRepository payoutRepository;
    @Mock private UserService userService;
    @Mock private WalletRepository walletRepository;
    @Mock private UserRepository userRepository;
    @Mock private CloudinaryService cloudinaryService;
    @Mock private NotificationService notificationService;
    @Mock private EmailService emailService;
    @Mock private MerchantNotificationPreferenceRepository notificationPrefRepository;
    @Mock private CheckoutSessionRepository checkoutSessionRepository;
    @Mock private MerchantAuditLogRepository auditLogRepository;
    @Mock private DisputeRepository disputeRepository;
    @Mock private MerchantInvoiceRepository invoiceRepository;
    @Mock private CheckoutService checkoutService;
    @Mock private MerchantSettlementService merchantSettlementService;

    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        merchantService = new MerchantService(
                merchantRepository, kybRecordRepository, kybDocumentRepository,
                apiKeyRepository, apiLogRepository, webhookRepository, webhookDeliveryRepository,
                payoutRepository, userService, walletRepository, userRepository,
                cloudinaryService, notificationService, emailService, notificationPrefRepository,
                checkoutSessionRepository, auditLogRepository, disputeRepository, invoiceRepository,
                checkoutService, merchantSettlementService);
    }

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
                () -> merchantService.register(userId,
                        registerRequest("INVALID HANDLE!", "My Shop")));

        assertEquals("INVALID_HANDLE", ex.getCode());
    }

    @Test
    void register_handleAlreadyTaken_throwsConflict() {
        when(merchantRepository.findByUserId(userId)).thenReturn(Optional.empty());
        when(merchantRepository.existsByBusinessHandle("taken_shop")).thenReturn(true);

        AppException ex = assertThrows(AppException.class,
                () -> merchantService.register(userId,
                        registerRequest("taken_shop", "My Shop")));

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
