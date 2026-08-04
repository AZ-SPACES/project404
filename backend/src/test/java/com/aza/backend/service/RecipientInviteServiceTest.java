package com.aza.backend.service;

import com.aza.backend.dto.merchant.RecipientInviteResponse;
import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.RecipientInvite;
import com.aza.backend.entity.User;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.repository.RecipientInviteRepository;
import com.aza.backend.util.RateLimitService;
import com.aza.backend.util.SmsService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * The invite flow exists because an integrator previously had no way to get a worker onto
 * Aza — every settlement mode but one needs the recipient to already exist.
 */
class RecipientInviteServiceTest {

    private final RecipientInviteRepository inviteRepository = mock(RecipientInviteRepository.class);
    private final MerchantRepository merchantRepository = mock(MerchantRepository.class);
    private final RecipientResolver recipientResolver = mock(RecipientResolver.class);
    private final WebhookService webhookService = mock(WebhookService.class);
    private final SmsService smsService = mock(SmsService.class);
    private final RateLimitService rateLimitService = mock(RateLimitService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final RecipientInviteService service = new RecipientInviteService(
            inviteRepository, merchantRepository, recipientResolver, webhookService,
            smsService, rateLimitService, objectMapper);

    private final UUID merchantId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "appBaseUrl", "https://aza.systems");
        when(inviteRepository.save(any(RecipientInvite.class))).thenAnswer(i -> {
            RecipientInvite r = i.getArgument(0);
            if (r.getId() == null) r.setId(UUID.randomUUID());
            return r;
        });
        when(merchantRepository.findById(merchantId)).thenReturn(Optional.of(
                Merchant.builder().id(merchantId).userId(UUID.randomUUID()).businessName("JobsCo")
                        .status(Merchant.MerchantStatus.ACTIVE).balance(BigDecimal.ZERO)
                        .currency("GHS").totalVolume(BigDecimal.ZERO).feeRateBps(150).build()));
    }

    @Test
    void invitingAnUnregisteredPersonTextsThemASignupLink() {
        when(inviteRepository.findByMerchantIdAndIdentifier(eq(merchantId), anyString()))
                .thenReturn(Optional.empty());
        when(recipientResolver.resolve(anyString())).thenReturn(
                new RecipientResolver.Resolution(null, RecipientResolver.Unpayable.NOT_FOUND));
        when(smsService.sendSms(anyString(), anyString())).thenReturn(true);

        RecipientInviteResponse res = service.invite(merchantId, "0241234567", "Kwame", "worker_7");

        assertEquals("PENDING", res.getStatus());
        assertTrue(res.isSmsSent());
        // Normalized on the way in, so fulfilment at signup matches regardless of shape.
        assertEquals("+233241234567", res.getRecipient());
        verify(smsService).sendSms(eq("+233241234567"), contains("aza.systems/signup"));
    }

    @Test
    void invitingSomeoneAlreadyOnAza_isImmediatelyFulfilledAndSendsNoSms() {
        // The integrator gets one consistent answer instead of having to special-case
        // "they were already here".
        UUID existingUserId = UUID.randomUUID();
        when(inviteRepository.findByMerchantIdAndIdentifier(eq(merchantId), anyString()))
                .thenReturn(Optional.empty());
        when(recipientResolver.resolve(anyString())).thenReturn(
                new RecipientResolver.Resolution(User.builder().id(existingUserId).build(), null));

        RecipientInviteResponse res = service.invite(merchantId, "+233241234567", null, null);

        assertEquals("FULFILLED", res.getStatus());
        assertFalse(res.isSmsSent());
        verifyNoInteractions(smsService);
    }

    @Test
    void anExistingButUnpayableAccountIsNotMarkedFulfilled() {
        // FULFILLED answers "you can pay them now". A frozen wallet cannot receive a cedi,
        // and no signup webhook will ever fire for someone who already has an account — so
        // saying FULFILLED would leave the integrator waiting on a settlement that fails.
        when(inviteRepository.findByMerchantIdAndIdentifier(eq(merchantId), anyString()))
                .thenReturn(Optional.empty());
        when(recipientResolver.resolve(anyString())).thenReturn(
                new RecipientResolver.Resolution(User.builder().id(UUID.randomUUID()).build(),
                        RecipientResolver.Unpayable.WALLET_FROZEN));

        RecipientInviteResponse res = service.invite(merchantId, "+233241234567", null, null);

        assertEquals("PENDING", res.getStatus());
        assertEquals("Recipient wallet is frozen", res.getUnpayableReason());
        verifyNoInteractions(smsService);
    }

    @Test
    void aSuspendedMerchantCannotSendInviteSms() {
        // Invites text the public under Aza's sender id; suspension has to stop that.
        when(merchantRepository.findById(merchantId)).thenReturn(Optional.of(
                Merchant.builder().id(merchantId).userId(UUID.randomUUID()).businessName("Spammy")
                        .status(Merchant.MerchantStatus.SUSPENDED).balance(BigDecimal.ZERO)
                        .currency("GHS").totalVolume(BigDecimal.ZERO).feeRateBps(150).build()));

        com.aza.backend.exception.AppException ex = assertThrows(
                com.aza.backend.exception.AppException.class,
                () -> service.invite(merchantId, "0241234567", null, null));

        assertEquals("NOT_ACTIVE", ex.getCode());
        verifyNoInteractions(smsService);
    }

    @Test
    void reInvitingIsIdempotent_ratherThanTextingThemTwice() {
        RecipientInvite existing = RecipientInvite.builder()
                .id(UUID.randomUUID()).merchantId(merchantId).identifier("+233241234567")
                .status(RecipientInvite.Status.PENDING).smsSent(true).build();
        when(inviteRepository.findByMerchantIdAndIdentifier(merchantId, "+233241234567"))
                .thenReturn(Optional.of(existing));

        RecipientInviteResponse res = service.invite(merchantId, "0241234567", null, null);

        assertEquals(existing.getId().toString(), res.getId());
        verifyNoInteractions(smsService);
        verify(inviteRepository, never()).save(any(RecipientInvite.class));
    }

    @Test
    void smsFailureDoesNotFailTheInvite() {
        when(inviteRepository.findByMerchantIdAndIdentifier(eq(merchantId), anyString()))
                .thenReturn(Optional.empty());
        when(recipientResolver.resolve(anyString())).thenReturn(
                new RecipientResolver.Resolution(null, RecipientResolver.Unpayable.NOT_FOUND));
        when(smsService.sendSms(anyString(), anyString())).thenThrow(new RuntimeException("gateway down"));

        RecipientInviteResponse res = service.invite(merchantId, "0241234567", null, null);

        assertEquals("PENDING", res.getStatus());
        assertFalse(res.isSmsSent());
        // The integrator can still share signupUrl themselves.
        assertNotNull(res.getSignupUrl());
    }

    // ── Fulfilment at signup ──────────────────────────────────────────────────

    @Test
    void signupFulfilsEveryWaitingMerchant() {
        User newUser = User.builder().id(UUID.randomUUID()).phoneNumber("+233241234567").build();
        RecipientInvite a = RecipientInvite.builder().id(UUID.randomUUID())
                .merchantId(UUID.randomUUID()).identifier("+233241234567")
                .reference("worker_7").status(RecipientInvite.Status.PENDING).build();
        RecipientInvite b = RecipientInvite.builder().id(UUID.randomUUID())
                .merchantId(UUID.randomUUID()).identifier("+233241234567")
                .status(RecipientInvite.Status.PENDING).build();
        when(inviteRepository.findAllByIdentifierAndStatus("+233241234567", RecipientInvite.Status.PENDING))
                .thenReturn(List.of(a, b));

        service.fulfilFor(newUser);

        assertEquals(RecipientInvite.Status.FULFILLED, a.getStatus());
        assertEquals(RecipientInvite.Status.FULFILLED, b.getStatus());
        assertEquals(newUser.getId(), a.getInvitedUserId());
        verify(webhookService).dispatch(eq(a.getMerchantId()), eq("recipient.registered"), anyString());
        verify(webhookService).dispatch(eq(b.getMerchantId()), eq("recipient.registered"), anyString());
    }

    @Test
    void fulfilmentWebhookRevealsNothingAboutTheUserBeyondPayability() {
        // The merchant learns the person they invited can now be paid, not who they are.
        User newUser = User.builder().id(UUID.randomUUID()).phoneNumber("+233241234567")
                .email("kwame@example.com").firstName("Kwame").lastName("Mensah").build();
        RecipientInvite invite = RecipientInvite.builder().id(UUID.randomUUID())
                .merchantId(merchantId).identifier("+233241234567")
                .status(RecipientInvite.Status.PENDING).build();
        when(inviteRepository.findAllByIdentifierAndStatus(anyString(), any()))
                .thenReturn(List.of(invite));

        service.fulfilFor(newUser);

        var payload = org.mockito.ArgumentCaptor.forClass(String.class);
        verify(webhookService).dispatch(any(), eq("recipient.registered"), payload.capture());
        String body = payload.getValue();
        assertFalse(body.contains("kwame@example.com"), "email must not leak");
        assertFalse(body.contains("Mensah"), "real name must not leak");
        assertFalse(body.contains(newUser.getId().toString()), "internal user id must not leak");
        assertTrue(body.contains("\"payable\":true"));
    }

    @Test
    void aFailingWebhookNeverBreaksSignup() {
        User newUser = User.builder().id(UUID.randomUUID()).phoneNumber("+233241234567").build();
        when(inviteRepository.findAllByIdentifierAndStatus(anyString(), any()))
                .thenThrow(new RuntimeException("database on fire"));

        assertDoesNotThrow(() -> service.fulfilFor(newUser));
    }

    @Test
    void anEmailInviteFulfilsWhenThatPersonSignsUp() {
        // The invite API accepts email and username, so fulfilment must match them too.
        // Matching only phone leaves an email invite PENDING forever — a silent, permanent
        // failure indistinguishable from "they just haven't joined yet".
        User newUser = User.builder().id(UUID.randomUUID())
                .phoneNumber("+233209999999").email("ama@example.com").build();
        RecipientInvite emailInvite = RecipientInvite.builder().id(UUID.randomUUID())
                .merchantId(merchantId).identifier("ama@example.com")
                .status(RecipientInvite.Status.PENDING).build();
        when(inviteRepository.findAllByIdentifierAndStatus("+233209999999", RecipientInvite.Status.PENDING))
                .thenReturn(List.of());
        when(inviteRepository.findAllByIdentifierAndStatus("ama@example.com", RecipientInvite.Status.PENDING))
                .thenReturn(List.of(emailInvite));

        service.fulfilFor(newUser);

        assertEquals(RecipientInvite.Status.FULFILLED, emailInvite.getStatus());
        verify(webhookService).dispatch(eq(merchantId), eq("recipient.registered"), anyString());
    }

    @Test
    void beingInvitedTwiceUnderDifferentIdentifiersFiresOneWebhookPerInvite() {
        User newUser = User.builder().id(UUID.randomUUID())
                .phoneNumber("+233241234567").email("ama@example.com").username("ama").build();
        RecipientInvite sameInvite = RecipientInvite.builder().id(UUID.randomUUID())
                .merchantId(merchantId).identifier("+233241234567")
                .status(RecipientInvite.Status.PENDING).build();
        // The same invite row surfacing under two lookups must not be dispatched twice.
        when(inviteRepository.findAllByIdentifierAndStatus(anyString(), any()))
                .thenReturn(List.of(sameInvite));

        service.fulfilFor(newUser);

        verify(webhookService, times(1)).dispatch(any(), eq("recipient.registered"), anyString());
    }

    @Test
    void aUserWithoutAPhoneIsANoOp() {
        assertDoesNotThrow(() -> service.fulfilFor(User.builder().id(UUID.randomUUID()).build()));
        verifyNoInteractions(webhookService);
    }
}
