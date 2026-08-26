package com.aza.backend.service;

import com.aza.backend.dto.merchant.CheckoutSessionResponse;
import com.aza.backend.dto.merchant.CreateCheckoutSessionRequest;
import com.aza.backend.entity.CheckoutSession;
import com.aza.backend.entity.Merchant;
import com.aza.backend.repository.*;
import com.aza.backend.util.EmailService;
import com.aza.backend.util.RateLimitService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Cross-tenant idempotency regression: a merchant reusing an idempotency key that a
 * DIFFERENT merchant already used must get a fresh session of its own — never the
 * other merchant's session. (The old unscoped findByIdempotencyKey leaked merchant A's
 * session id, amount, and checkout URL to merchant B.)
 */
class CheckoutIdempotencyScopeTest {

    private final CheckoutSessionRepository sessionRepository = mock(CheckoutSessionRepository.class);
    private final CheckoutSessionSplitRepository splitRepository = mock(CheckoutSessionSplitRepository.class);
    private final MerchantRepository merchantRepository = mock(MerchantRepository.class);
    private final WalletRepository walletRepository = mock(WalletRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final TransactionRepository transactionRepository = mock(TransactionRepository.class);
    private final WebhookEndpointRepository webhookEndpointRepository = mock(WebhookEndpointRepository.class);
    private final WebhookDeliveryRepository webhookDeliveryRepository = mock(WebhookDeliveryRepository.class);
    private final UserService userService = mock(UserService.class);
    private final RateLimitService rateLimitService = mock(RateLimitService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final EmailService emailService = mock(EmailService.class);
    private final MerchantNotificationPreferenceRepository notificationPrefRepository =
            mock(MerchantNotificationPreferenceRepository.class);
    private final NotificationService notificationService = mock(NotificationService.class);
    private final RecipientResolver recipientResolver = mock(RecipientResolver.class);
    private final HoldService holdService = mock(HoldService.class);

    private final CheckoutService service = new CheckoutService(
            sessionRepository, splitRepository, merchantRepository, walletRepository,
            new WalletLedger(walletRepository, new WalletLocker(walletRepository), transactionRepository), new MerchantFeeCalculator(mock(FeeCalculationService.class)), userRepository,
            transactionRepository, webhookEndpointRepository, webhookDeliveryRepository, userService,
            rateLimitService, objectMapper, emailService, notificationPrefRepository, notificationService,
            recipientResolver, holdService);

    private final UUID merchantAId = UUID.randomUUID();
    private final UUID merchantBId = UUID.randomUUID();
    private static final String SHARED_KEY = "order_1";

    private Merchant merchant(UUID id, String name) {
        return Merchant.builder().id(id).userId(UUID.randomUUID()).businessName(name)
                .status(Merchant.MerchantStatus.ACTIVE).balance(BigDecimal.ZERO)
                .currency("GHS").totalVolume(BigDecimal.ZERO).feeRateBps(150).build();
    }

    private CreateCheckoutSessionRequest request(String amount) {
        CreateCheckoutSessionRequest req = new CreateCheckoutSessionRequest();
        req.setAmount(new BigDecimal(amount));
        req.setIdempotencyKey(SHARED_KEY);
        return req;
    }

    private void stubSessionSave() {
        when(sessionRepository.save(any(CheckoutSession.class))).thenAnswer(inv -> {
            CheckoutSession s = inv.getArgument(0);
            if (s.getId() == null) s.setId(UUID.randomUUID());
            return s;
        });
    }

    @Test
    void reusedKeyFromAnotherMerchant_createsFreshSession_neverReturnsTheirs() {
        // Merchant A already holds a session under SHARED_KEY.
        UUID merchantASessionId = UUID.randomUUID();

        when(merchantRepository.findById(merchantBId)).thenReturn(Optional.of(merchant(merchantBId, "ShopB")));
        // Scoped lookup: nothing exists for (merchantB, SHARED_KEY), regardless of merchant A's session.
        when(sessionRepository.findByMerchantIdAndIdempotencyKey(merchantBId, SHARED_KEY))
                .thenReturn(Optional.empty());
        stubSessionSave();

        CheckoutSessionResponse res = service.createSession(merchantBId, request("50.00"));

        // B got a brand-new session, not A's.
        assertNotNull(res.getId());
        assertNotEquals(merchantASessionId.toString(), res.getId());
        verify(sessionRepository).save(any(CheckoutSession.class));
        // The lookup was scoped to the calling merchant — this is the security property.
        verify(sessionRepository).findByMerchantIdAndIdempotencyKey(merchantBId, SHARED_KEY);
    }

    @Test
    void reusedKeyFromSameMerchant_returnsExistingSession_withoutCreatingAnother() {
        Merchant a = merchant(merchantAId, "ShopA");
        CheckoutSession existing = CheckoutSession.builder()
                .id(UUID.randomUUID()).merchantId(merchantAId)
                .amount(new BigDecimal("50.00")).currency("GHS")
                .status(CheckoutSession.SessionStatus.PENDING)
                .idempotencyKey(SHARED_KEY)
                .build();

        when(merchantRepository.findById(merchantAId)).thenReturn(Optional.of(a));
        when(sessionRepository.findByMerchantIdAndIdempotencyKey(merchantAId, SHARED_KEY))
                .thenReturn(Optional.of(existing));

        CheckoutSessionResponse res = service.createSession(merchantAId, request("50.00"));

        assertEquals(existing.getId().toString(), res.getId());
        verify(sessionRepository, never()).save(any(CheckoutSession.class));
    }
}
