package com.aza.backend.service;

import com.aza.backend.dto.merchant.RecipientInviteResponse;
import com.aza.backend.entity.Merchant;
import com.aza.backend.entity.RecipientInvite;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.MerchantRepository;
import com.aza.backend.repository.RecipientInviteRepository;
import com.aza.backend.util.PhoneNumberUtil;
import com.aza.backend.util.RateLimitService;
import com.aza.backend.util.SmsService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Invites a person onto Aza on a merchant's behalf.
 *
 * This closes the gap that actually blocks adoption of held settlement: every mode except
 * paying the integrator's own balance needs the recipient to already exist, and Sign in
 * with Aza only authenticates people who do. A jobs marketplace could not onboard a plumber
 * who had never heard of Aza — it could only fail hold creation and tell them to go away.
 *
 * An invite carries no money and grants no authority. It is a note that a merchant wants to
 * pay this identifier, so that when the person signs up the merchant is told rather than
 * having to poll.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RecipientInviteService {

    private final RecipientInviteRepository inviteRepository;
    private final MerchantRepository merchantRepository;
    private final RecipientResolver recipientResolver;
    private final WebhookService webhookService;
    private final SmsService smsService;
    private final RateLimitService rateLimitService;
    private final ObjectMapper objectMapper;

    @Value("${app.base-url:https://aza.systems}")
    private String appBaseUrl;

    // ==================== CREATE ====================

    /**
     * Invite someone to join Aza so this merchant can pay them.
     *
     * Idempotent per (merchant, person): re-inviting returns the existing invite rather than
     * sending a second SMS to someone who already got one. If the person already has an
     * account the invite is created already-fulfilled, so the integrator gets one consistent
     * answer instead of having to special-case "they were already here".
     */
    @Transactional
    public RecipientInviteResponse invite(UUID merchantId, String rawIdentifier,
                                          String displayName, String reference) {
        if (rawIdentifier == null || rawIdentifier.isBlank()) {
            throw new AppException("VALIDATION", "recipient is required", HttpStatus.BAD_REQUEST);
        }
        // Invites send SMS, so they are rate limited harder than a lookup: this endpoint
        // must not become a way to text arbitrary Ghanaian numbers on Aza's sender id.
        rateLimitService.enforceRateLimit("invite:" + merchantId, 100, Duration.ofHours(1));

        Merchant merchant = merchantRepository.findById(merchantId)
                .orElseThrow(() -> new AppException("NOT_FOUND", "Merchant not found", HttpStatus.NOT_FOUND));

        // This endpoint sends SMS under Aza's sender id. A suspended merchant must not keep
        // texting the public with it — suspension exists partly to stop exactly that.
        if (merchant.getStatus() != Merchant.MerchantStatus.ACTIVE) {
            throw new AppException("NOT_ACTIVE",
                    "Your merchant account must be active to invite recipients", HttpStatus.FORBIDDEN);
        }

        String identifier = PhoneNumberUtil.normalize(rawIdentifier.trim());

        RecipientInvite existing = inviteRepository
                .findByMerchantIdAndIdentifier(merchantId, identifier).orElse(null);
        if (existing != null) return toResponse(existing);

        RecipientInvite invite = RecipientInvite.builder()
                .merchantId(merchantId)
                .identifier(identifier)
                .displayName(displayName)
                .reference(reference)
                .status(RecipientInvite.Status.PENDING)
                .build();

        // Already payable on Aza: record it as fulfilled immediately and send nothing, so the
        // integrator can go straight to creating the hold.
        //
        // Payability, not mere existence, is the bar. An invite answers "when can I pay this
        // person" — marking an inactive or frozen account FULFILLED would answer "now" and
        // send payable:true for someone who cannot receive a cedi. They stay PENDING instead,
        // and become fulfilled if their account is restored.
        RecipientResolver.Resolution resolution = recipientResolver.resolve(identifier);
        if (resolution.payable()) {
            invite.setStatus(RecipientInvite.Status.FULFILLED);
            invite.setInvitedUserId(resolution.user().getId());
            invite.setFulfilledAt(LocalDateTime.now());
            invite = inviteRepository.save(invite);
            return toResponse(invite);
        }
        if (resolution.user() != null) {
            // The account exists but cannot receive money. No signup will ever fire for them,
            // so say why rather than leaving the integrator waiting on a webhook that cannot come.
            invite = inviteRepository.save(invite);
            RecipientInviteResponse response = toResponse(invite);
            response.setUnpayableReason(resolution.problem().reason);
            return response;
        }

        invite = inviteRepository.save(invite);

        if (PhoneNumberUtil.looksLikePhone(identifier)) {
            boolean sent = trySms(identifier, merchant);
            invite.setSmsSent(sent);
            inviteRepository.save(invite);
        }

        log.info("Recipient invited: merchantId={}, inviteId={}, smsSent={}",
                merchantId, invite.getId(), invite.getSmsSent());
        return toResponse(invite);
    }

    /** SMS failure must not fail the invite — the integrator can still share the link itself. */
    private boolean trySms(String phone, Merchant merchant) {
        try {
            return smsService.sendSms(phone,
                    merchant.getBusinessName() + " wants to pay you through Aza. "
                            + "Create your free account to receive it: " + signupUrl());
        } catch (Exception e) {
            log.warn("Recipient invite: SMS failed for {}: {}", phone, e.getMessage());
            return false;
        }
    }

    // ==================== FULFILMENT ====================

    /**
     * Called when someone finishes signing up. Any merchant waiting on this identifier is
     * told they are now payable.
     *
     * Never throws into the signup path: a webhook problem must not stop someone creating
     * an account.
     */
    @Transactional
    public void fulfilFor(User user) {
        try {
            // Match every identifier the invite API accepts, not just phone. An invite is
            // stored exactly as it was sent, so someone invited by email who signs up with
            // that email must still fulfil — otherwise the invite sits PENDING forever and
            // the integrator waits on a webhook that can never arrive. Silent, permanent,
            // and indistinguishable from "they just haven't joined yet".
            List<String> identifiers = new java.util.ArrayList<>();
            if (user.getPhoneNumber() != null && !user.getPhoneNumber().isBlank()) {
                identifiers.add(PhoneNumberUtil.normalize(user.getPhoneNumber()));
            }
            if (user.getEmail() != null && !user.getEmail().isBlank()) {
                identifiers.add(user.getEmail().trim());
            }
            if (user.getUsername() != null && !user.getUsername().isBlank()) {
                identifiers.add(user.getUsername().trim());
            }
            if (identifiers.isEmpty()) return;

            // Distinct by id: one person can be invited under several identifiers by the
            // same merchant, and each invite must fire exactly one webhook.
            java.util.Map<UUID, RecipientInvite> pendingById = new java.util.LinkedHashMap<>();
            for (String identifier : identifiers) {
                for (RecipientInvite invite : inviteRepository
                        .findAllByIdentifierAndStatus(identifier, RecipientInvite.Status.PENDING)) {
                    pendingById.putIfAbsent(invite.getId(), invite);
                }
            }
            if (pendingById.isEmpty()) return;

            List<RecipientInvite> pending = new java.util.ArrayList<>(pendingById.values());
            for (RecipientInvite invite : pending) {
                invite.setStatus(RecipientInvite.Status.FULFILLED);
                invite.setInvitedUserId(user.getId());
                invite.setFulfilledAt(LocalDateTime.now());
                inviteRepository.save(invite);
                notifyMerchant(invite, user);
            }
            log.info("Recipient invites fulfilled: userId={}, invites={}", user.getId(), pending.size());
        } catch (Exception e) {
            log.error("Recipient invite fulfilment failed for user {}: {}", user.getId(), e.getMessage(), e);
        }
    }

    private void notifyMerchant(RecipientInvite invite, User user) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("event", "recipient.registered");
            payload.put("inviteId", invite.getId().toString());
            payload.put("recipient", invite.getIdentifier());
            payload.put("reference", invite.getReference());
            payload.put("displayName", invite.getDisplayName());
            payload.put("registeredAt", LocalDateTime.now().toString());
            // Deliberately no user id, email, or real name: the merchant learns the person
            // they invited can now be paid, not who they turned out to be.
            payload.put("payable", true);
            webhookService.dispatch(invite.getMerchantId(), "recipient.registered",
                    objectMapper.writeValueAsString(payload));
        } catch (Exception e) {
            log.error("Failed to dispatch recipient.registered for invite {}: {}",
                    invite.getId(), e.getMessage());
        }
    }

    // ==================== READ ====================

    public org.springframework.data.domain.Page<RecipientInviteResponse> list(
            UUID merchantId, int page, int size) {
        return inviteRepository.findAllByMerchantIdOrderByCreatedAtDesc(
                        merchantId, org.springframework.data.domain.PageRequest.of(page, size))
                .map(this::toResponse);
    }

    /** Where an uninvited person should be sent to create an account. */
    public String signupUrl() {
        return appBaseUrl + "/signup";
    }

    private RecipientInviteResponse toResponse(RecipientInvite invite) {
        return RecipientInviteResponse.builder()
                .id(invite.getId().toString())
                .recipient(invite.getIdentifier())
                .displayName(invite.getDisplayName())
                .reference(invite.getReference())
                .status(invite.getStatus().name())
                .smsSent(Boolean.TRUE.equals(invite.getSmsSent()))
                .signupUrl(signupUrl())
                .createdAt(invite.getCreatedAt())
                .fulfilledAt(invite.getFulfilledAt())
                .build();
    }
}
