package com.aza.backend.service;

import com.aza.backend.dto.merchant.CheckoutSessionResponse;
import com.aza.backend.entity.*;
import com.aza.backend.exception.AppException;
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
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Refund clawback for split (marketplace) checkout sessions. */
class CheckoutRefundSplitTest {

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

    private final CheckoutService service = new CheckoutService(
            sessionRepository, splitRepository, merchantRepository, walletRepository, userRepository,
            transactionRepository, webhookEndpointRepository, webhookDeliveryRepository, userService,
            rateLimitService, objectMapper, emailService, notificationPrefRepository, notificationService);

    private final UUID merchantId = UUID.randomUUID();
    private final UUID ownerUserId = UUID.randomUUID();
    private final UUID customerId = UUID.randomUUID();
    private final UUID sellerId = UUID.randomUUID();
    private final UUID sessionId = UUID.randomUUID();

    private Merchant merchant(String balance) {
        return Merchant.builder().id(merchantId).userId(ownerUserId).businessName("TradePay")
                .status(Merchant.MerchantStatus.ACTIVE).balance(new BigDecimal(balance))
                .currency("GHS").totalVolume(BigDecimal.ZERO).feeRateBps(150).build();
    }

    private CheckoutSession completedSession() {
        return CheckoutSession.builder().id(sessionId).merchantId(merchantId)
                .amount(new BigDecimal("100.00")).currency("GHS")
                .status(CheckoutSession.SessionStatus.COMPLETED).customerId(customerId)
                .platformFee(new BigDecimal("1.50")).netAmount(new BigDecimal("38.50"))
                .build();
    }

    private CheckoutSessionSplit creditedSplit(String amount) {
        return CheckoutSessionSplit.builder().id(UUID.randomUUID()).sessionId(sessionId)
                .recipientUserId(sellerId).recipientIdentifier("ama@example.com")
                .amount(new BigDecimal(amount)).status(CheckoutSessionSplit.Status.CREDITED).build();
    }

    private Wallet wallet(UUID uid, String balance) {
        return Wallet.builder().userId(uid).balance(new BigDecimal(balance)).currency("GHS").frozen(false).build();
    }

    private void stubSaves() {
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(inv -> {
            Transaction t = inv.getArgument(0);
            if (t.getId() == null) t.setId(UUID.randomUUID());
            return t;
        });
    }

    @Test
    void refund_clawsBackSellerShareAndPlatformPortion() {
        Merchant m = merchant("500.00");
        Wallet sellerW = wallet(sellerId, "60.00");   // seller got 60, still has it
        Wallet customerW = wallet(customerId, "0.00");

        when(sessionRepository.findByIdAndMerchantId(sessionId, merchantId)).thenReturn(Optional.of(completedSession()));
        when(userRepository.findById(customerId)).thenReturn(Optional.of(User.builder().id(customerId).build()));
        when(userRepository.findById(sellerId)).thenReturn(Optional.of(User.builder().id(sellerId).build()));
        when(merchantRepository.findByIdForUpdate(merchantId)).thenReturn(Optional.of(m));
        when(splitRepository.findAllBySessionId(sessionId)).thenReturn(List.of(creditedSplit("60.00")));
        when(walletRepository.findByUserIdForUpdate(sellerId)).thenReturn(Optional.of(sellerW));
        when(walletRepository.findByUserIdForUpdate(customerId)).thenReturn(Optional.of(customerW));
        stubSaves();

        CheckoutSessionResponse res = service.refundSession(merchantId, sessionId);

        assertEquals("REFUNDED", res.getStatus());
        // Customer made whole for the full 100.
        assertEquals(0, new BigDecimal("100.00").compareTo(customerW.getBalance()));
        // Seller clawed back 60.
        assertEquals(0, new BigDecimal("0.00").compareTo(sellerW.getBalance()));
        // Platform covered 40 (its kept share + the absorbed Aza fee): 500 - 40 = 460.
        assertEquals(0, new BigDecimal("460.00").compareTo(m.getBalance()));
    }

    @Test
    void refund_failsWhenSellerAlreadySpentShare() {
        Merchant m = merchant("500.00");
        Wallet sellerW = wallet(sellerId, "10.00");   // seller spent most of the 60

        when(sessionRepository.findByIdAndMerchantId(sessionId, merchantId)).thenReturn(Optional.of(completedSession()));
        when(userRepository.findById(customerId)).thenReturn(Optional.of(User.builder().id(customerId).build()));
        when(merchantRepository.findByIdForUpdate(merchantId)).thenReturn(Optional.of(m));
        when(splitRepository.findAllBySessionId(sessionId)).thenReturn(List.of(creditedSplit("60.00")));
        when(walletRepository.findByUserIdForUpdate(sellerId)).thenReturn(Optional.of(sellerW));

        AppException ex = assertThrows(AppException.class, () -> service.refundSession(merchantId, sessionId));
        assertEquals("SELLER_CLAWBACK_INSUFFICIENT", ex.getCode());
        // No money moved.
        assertEquals(0, new BigDecimal("500.00").compareTo(m.getBalance()));
        verify(transactionRepository, never()).save(any());
    }
}
