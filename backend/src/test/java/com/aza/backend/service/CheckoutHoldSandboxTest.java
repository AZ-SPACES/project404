package com.aza.backend.service;

import com.aza.backend.dto.merchant.CheckoutSessionResponse;
import com.aza.backend.dto.merchant.ConfirmCheckoutRequest;
import com.aza.backend.entity.CheckoutSession;
import com.aza.backend.entity.Merchant;
import com.aza.backend.repository.*;
import com.aza.backend.util.EmailService;
import com.aza.backend.util.RateLimitService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Sandbox parity for manual release. A test-mode session must produce a real hold, or an
 * integrator cannot exercise release/refund with an aza_test_ key before going live —
 * which is the one flow they most need to rehearse.
 */
class CheckoutHoldSandboxTest {

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

    private final UUID sessionId = UUID.randomUUID();
    private final UUID merchantId = UUID.randomUUID();
    private final UUID customerId = UUID.randomUUID();

    private Merchant merchant() {
        return Merchant.builder().id(merchantId).userId(UUID.randomUUID()).businessName("JobsCo")
                .businessHandle("jobsco").status(Merchant.MerchantStatus.ACTIVE)
                .balance(BigDecimal.ZERO).currency("GHS").totalVolume(BigDecimal.ZERO)
                .feeRateBps(150).build();
    }

    private CheckoutSession testSession(CheckoutSession.ReleaseMode mode) {
        return CheckoutSession.builder()
                .id(sessionId).merchantId(merchantId)
                .amount(new BigDecimal("250.00")).currency("GHS")
                .status(CheckoutSession.SessionStatus.PENDING)
                .testMode(true).releaseMode(mode).maxHoldDays(30)
                .build();
    }

    @Test
    void testModeManualSession_createsAHoldSoReleaseCanBeRehearsed() {
        CheckoutSession session = testSession(CheckoutSession.ReleaseMode.MANUAL);
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        when(merchantRepository.findById(merchantId)).thenReturn(Optional.of(merchant()));
        when(splitRepository.findAllBySessionId(sessionId)).thenReturn(List.of());
        when(sessionRepository.save(any(CheckoutSession.class))).thenAnswer(i -> i.getArgument(0));

        CheckoutSessionResponse res = service.confirmPayment(sessionId, customerId, new ConfirmCheckoutRequest());

        verify(holdService).capture(eq(session), any(Merchant.class), eq(customerId),
                any(BigDecimal.class), anyList());
        assertEquals("COMPLETED", res.getStatus());
        // Nothing settles to the merchant at capture, sandbox or not.
        assertEquals(BigDecimal.ZERO, session.getNetAmount());
    }

    @Test
    void testModeAutomaticSession_stillSettlesImmediately_andCreatesNoHold() {
        CheckoutSession session = testSession(CheckoutSession.ReleaseMode.AUTOMATIC);
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        when(merchantRepository.findById(merchantId)).thenReturn(Optional.of(merchant()));
        when(splitRepository.findAllBySessionId(sessionId)).thenReturn(List.of());
        when(sessionRepository.save(any(CheckoutSession.class))).thenAnswer(i -> i.getArgument(0));

        service.confirmPayment(sessionId, customerId, new ConfirmCheckoutRequest());

        verify(holdService, never()).capture(any(), any(), any(), any(), anyList());
        // 250 − 1.5% fee, nothing held back.
        assertEquals(new BigDecimal("246.25"), session.getNetAmount());
    }

    @Test
    void payerFacingSessionDisclosesThatThePaymentIsHeld() {
        // The payer confirms on Aza's own checkout page. They must be able to see, before
        // confirming, that this money is held rather than paid out — Aza cannot later rule
        // on whether it should be released, so the disclosure has to happen up front.
        CheckoutSession session = testSession(CheckoutSession.ReleaseMode.MANUAL);
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        when(merchantRepository.findById(merchantId)).thenReturn(Optional.of(merchant()));

        CheckoutSessionResponse res = service.getSession(sessionId);

        assertEquals("MANUAL", res.getRelease());
    }
}
