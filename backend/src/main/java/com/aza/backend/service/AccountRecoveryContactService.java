package com.aza.backend.service;

import com.aza.backend.dto.auth.AccountRecoveryContactResponse;
import com.aza.backend.dto.auth.AuthResponse;
import com.aza.backend.entity.AccountRecoveryContact;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.AccountRecoveryContactRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.util.RateLimitService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AccountRecoveryContactService {

    private static final int MAX_CONTACTS = 3;
    private static final String REQUEST_PREFIX = "arc_req:";
    private static final String CODE_PREFIX   = "arc_code:";

    private final AccountRecoveryContactRepository repo;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final AuthService authService;
    private final TotpService totpService;
    private final TotpEncryptionService totpEncryptionService;
    private final StringRedisTemplate redisTemplate;
    private final RateLimitService rateLimitService;

    // ── MANAGE CONTACTS ──────────────────────────────────────────────────────

    @Transactional
    public AccountRecoveryContactResponse inviteContact(User user, UUID contactUserId) {
        if (user.getId().equals(contactUserId)) {
            throw new AppException("You cannot add yourself as a recovery contact");
        }
        User contact = userRepository.findById(contactUserId)
                .orElseThrow(() -> new AppException("User not found"));

        // Bug fix: only re-use REMOVED entries, not active/pending ones
        AccountRecoveryContact entry = repo.findByUserIdAndContactUserId(user.getId(), contactUserId)
                .map(existing -> {
                    if (existing.getStatus() != AccountRecoveryContact.Status.REMOVED) {
                        throw new AppException("This person is already your recovery contact or has a pending invitation");
                    }
                    return existing;
                })
                .orElseGet(() -> {
                    // Count only non-removed entries for the limit check
                    long count = repo.countByUserIdAndStatusNot(user.getId(), AccountRecoveryContact.Status.REMOVED);
                    if (count >= MAX_CONTACTS) {
                        throw new AppException("You can have at most " + MAX_CONTACTS + " recovery contacts");
                    }
                    return AccountRecoveryContact.builder()
                            .userId(user.getId())
                            .contactUserId(contactUserId)
                            .build();
                });

        entry.setStatus(AccountRecoveryContact.Status.PENDING);
        entry.setEncryptedTotpSecret(null); // cleared — new secret generated on accept
        repo.save(entry);

        try {
            notificationService.sendRecoveryContactInvite(
                    contactUserId,
                    entry.getId(),
                    user.getFirstName() + " " + user.getLastName(),
                    user.getUsername());
        } catch (Exception e) {
            log.warn("Failed to send recovery contact invite notification to {}: {}", contactUserId, e.getMessage());
        }

        return toResponse(entry, contact);
    }

    @Transactional
    public AccountRecoveryContactResponse acceptInvitation(User contact, UUID entryId) {
        AccountRecoveryContact entry = getEntry(entryId);
        if (!entry.getContactUserId().equals(contact.getId())) {
            throw new AppException("Not authorized");
        }
        if (entry.getStatus() != AccountRecoveryContact.Status.PENDING) {
            throw new AppException("Invitation is no longer pending");
        }

        // Generate a TOTP secret for this relationship — returned ONCE to the contact's device
        String plainSecret = totpService.generateSecret();
        entry.setEncryptedTotpSecret(totpEncryptionService.encrypt(plainSecret));
        entry.setStatus(AccountRecoveryContact.Status.ACTIVE);
        repo.save(entry);

        User owner = userRepository.findById(entry.getUserId()).orElse(null);
        return toResponseFromOwner(entry, owner, plainSecret);
    }

    @Transactional
    public void declineInvitation(User contact, UUID entryId) {
        AccountRecoveryContact entry = getEntry(entryId);
        if (!entry.getContactUserId().equals(contact.getId())) {
            throw new AppException("Not authorized");
        }
        if (entry.getStatus() == AccountRecoveryContact.Status.REMOVED) {
            throw new AppException("Invitation already removed");
        }
        entry.setStatus(AccountRecoveryContact.Status.REMOVED);
        repo.save(entry);
    }

    @Transactional
    public void removeContact(User user, UUID entryId) {
        AccountRecoveryContact entry = getEntry(entryId);
        if (!entry.getUserId().equals(user.getId())) {
            throw new AppException("Not authorized");
        }
        entry.setStatus(AccountRecoveryContact.Status.REMOVED);
        entry.setEncryptedTotpSecret(null);
        repo.save(entry);
    }

    @Transactional
    public void removeAsContact(User contact, UUID entryId) {
        AccountRecoveryContact entry = getEntry(entryId);
        if (!entry.getContactUserId().equals(contact.getId())) {
            throw new AppException("Not authorized");
        }
        entry.setStatus(AccountRecoveryContact.Status.REMOVED);
        entry.setEncryptedTotpSecret(null);
        repo.save(entry);
    }

    public List<AccountRecoveryContactResponse> getMyContacts(User user) {
        return repo.findAllByUserIdAndStatusNot(user.getId(), AccountRecoveryContact.Status.REMOVED)
                .stream()
                .map(e -> toResponse(e, userRepository.findById(e.getContactUserId()).orElse(null)))
                .toList();
    }

    public List<AccountRecoveryContactResponse> getPendingInvitations(User contact) {
        return repo.findAllByContactUserIdAndStatus(contact.getId(), AccountRecoveryContact.Status.PENDING)
                .stream()
                .map(e -> toResponseFromOwner(e, userRepository.findById(e.getUserId()).orElse(null), null))
                .toList();
    }

    // ── RECOVERY FLOW ────────────────────────────────────────────────────────

    /**
     * Locked-out user requests help. Sends a push notification to their contact
     * and returns a requestId so the redemption step can identify the right contact.
     */
    public String requestRecovery(String preAuthToken, UUID entryId, String ipAddress) {
        rateLimitService.enforceRateLimit("arc_request:" + ipAddress, 5, Duration.ofMinutes(15));

        User user = authService.getUserFromPreAuth(preAuthToken);
        AccountRecoveryContact entry = getEntry(entryId);
        if (!entry.getUserId().equals(user.getId()) || entry.getStatus() != AccountRecoveryContact.Status.ACTIVE) {
            throw new AppException("Recovery contact not found or not active");
        }

        // requestId ties preAuthToken → specific contact relationship
        String requestId = UUID.randomUUID().toString();
        redisTemplate.opsForValue().set(
                REQUEST_PREFIX + requestId,
                user.getId() + "|" + entryId,  // note: entryId, not contactUserId
                Duration.ofMinutes(30));

        try {
            notificationService.sendRecoveryContactRequest(
                    entry.getContactUserId(),
                    requestId,
                    user.getFirstName() + " " + user.getLastName(),
                    user.getUsername());
        } catch (Exception e) {
            log.warn("Failed to send recovery request notification: {}", e.getMessage());
        }

        return requestId;
    }

    /**
     * Validates the rotating TOTP code the contact read from their app.
     * The contact's app generates this offline — no network call required from them.
     */
    @Transactional
    public AuthResponse redeemRotatingCode(String preAuthToken, UUID requestId, String code, String ipAddress) {
        rateLimitService.enforceRateLimit("arc_redeem:" + ipAddress, 5, Duration.ofMinutes(15));

        User user = authService.getUserFromPreAuth(preAuthToken);

        // Validate the request belongs to this user and resolve the contact entry
        String requestValue = redisTemplate.opsForValue().get(REQUEST_PREFIX + requestId);
        if (requestValue == null) throw new AppException("Recovery request expired or not found");

        String[] parts = requestValue.split("\\|");
        if (!UUID.fromString(parts[0]).equals(user.getId())) throw new AppException("Invalid recovery request");
        UUID entryId = UUID.fromString(parts[1]);

        AccountRecoveryContact entry = getEntry(entryId);
        if (entry.getEncryptedTotpSecret() == null) {
            throw new AppException("This contact hasn't set up their recovery key yet. Ask them to accept the invitation again.");
        }

        String secret = totpEncryptionService.decrypt(entry.getEncryptedTotpSecret());
        if (totpService.isCodeInvalid(secret, code)) {
            throw new AppException("Invalid recovery code. Make sure you have the latest code from your contact.");
        }

        // Replay prevention — same 90-second window as login TOTP
        String replayKey = "arc_used:" + entryId + ":" + code;
        if (Boolean.TRUE.equals(redisTemplate.hasKey(replayKey))) {
            throw new AppException("This code has already been used. Wait for the next code from your contact.");
        }
        redisTemplate.opsForValue().set(replayKey, "used", Duration.ofSeconds(90));

        redisTemplate.delete(REQUEST_PREFIX + requestId);
        log.info("Account recovery completed for user {} via contact entry {}", user.getId(), entryId);
        return authService.finalizeLoginFromPreAuth(preAuthToken, ipAddress);
    }

    public List<AccountRecoveryContactResponse> getActiveContactsForPreAuth(String preAuthToken) {
        User user = authService.getUserFromPreAuth(preAuthToken);
        return repo.findAllByUserIdAndStatusNot(user.getId(), AccountRecoveryContact.Status.REMOVED)
                .stream()
                .filter(e -> e.getStatus() == AccountRecoveryContact.Status.ACTIVE)
                .map(e -> toResponse(e, userRepository.findById(e.getContactUserId()).orElse(null)))
                .toList();
    }

    // ── HELPERS ──────────────────────────────────────────────────────────────

    private AccountRecoveryContact getEntry(UUID id) {
        return repo.findById(id)
                .orElseThrow(() -> new AppException("Recovery contact entry not found"));
    }

    private AccountRecoveryContactResponse toResponse(AccountRecoveryContact entry, User contact) {
        return AccountRecoveryContactResponse.builder()
                .id(entry.getId())
                .status(entry.getStatus().name())
                .contactUserId(entry.getContactUserId())
                .contactName(contact != null ? contact.getFirstName() + " " + contact.getLastName() : "Unknown")
                .contactHandle(contact != null ? contact.getUsername() : null)
                .contactAvatarUrl(contact != null ? contact.getProfileImageUrl() : null)
                .build();
    }

    /** Used for pending invitations — contactUserId here is the owner (the person who invited). */
    private AccountRecoveryContactResponse toResponseFromOwner(AccountRecoveryContact entry, User owner, String totpSecret) {
        return AccountRecoveryContactResponse.builder()
                .id(entry.getId())
                .status(entry.getStatus().name())
                .contactUserId(entry.getUserId())
                .contactName(owner != null ? owner.getFirstName() + " " + owner.getLastName() : "Unknown")
                .contactHandle(owner != null ? owner.getUsername() : null)
                .contactAvatarUrl(owner != null ? owner.getProfileImageUrl() : null)
                .totpSecret(totpSecret)
                .build();
    }
}
