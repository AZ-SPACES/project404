package com.aza.backend.service;

import com.aza.backend.dto.contact.*;
import com.aza.backend.entity.BlockedUser;
import com.aza.backend.entity.Contact;
import com.aza.backend.entity.ContactRequest;
import com.aza.backend.entity.User;
import com.aza.backend.repository.BlockedUserRepository;
import com.aza.backend.repository.ContactRepository;
import com.aza.backend.repository.ContactRequestRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.util.RateLimitService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ContactService {

    private final ContactRepository contactRepository;
    private final UserRepository userRepository;
    private final BlockedUserRepository blockedUserRepository;
    private final ContactRequestRepository contactRequestRepository;
    private final RateLimitService rateLimitService;

    //LIST CONTACTS

    public Page<ContactResponse> listContacts(UUID userId, int page, int size) {
        Page<Contact> contacts = contactRepository.findAllByOwnerUserId(
                userId, PageRequest.of(page, size));
        return contacts.map(this::toContactResponse);
    }

    //SYNC DEVICE CONTACTS

    @Transactional
    public ContactSyncResponse syncContacts(User owner, ContactSyncRequest request) {
        // Rate limit: max 5 syncs per hour
        rateLimitService.enforceRateLimit(
                "contact_sync:" + owner.getId(), 5, Duration.ofHours(1));

        List<ContactResponse> results = new ArrayList<>();
        int azaUsersFound = 0;

        for (ContactSyncRequest.DeviceContact deviceContact : request.getContacts()) {
            if (deviceContact.getPhoneNumber() == null || deviceContact.getPhoneNumber().isBlank()) {
                continue;
            }

            String phone = normalizePhone(deviceContact.getPhoneNumber());

            // Skip the owner's own phone number
            if (phone.equals(owner.getPhoneNumber())) {
                continue;
            }

            // Check if this contact already exists for this user
            Optional<Contact> existingContact = contactRepository
                    .findByOwnerUserIdAndPhoneNumber(owner.getId(), phone);

            Contact contact;
            if (existingContact.isPresent()) {
                contact = existingContact.get();
                // Update display name if changed
                if (deviceContact.getDisplayName() != null) {
                    contact.setDisplayName(deviceContact.getDisplayName());
                }
            } else {
                contact = Contact.builder()
                        .ownerUserId(owner.getId())
                        .phoneNumber(phone)
                        .displayName(deviceContact.getDisplayName())
                        .email(deviceContact.getEmail())
                        .build();
            }

            // Check if this phone belongs to an Aza user (respecting privacy)
            Optional<User> azaUser = userRepository.findByPhoneNumber(phone);
            if (azaUser.isPresent() && Boolean.TRUE.equals(azaUser.get().getFindMeByPhone())) {
                User matchedUser = azaUser.get();
                contact.setContactUserId(matchedUser.getId());
                contact.setIsAzaUser(true);

                // Use Aza display name if the device contact name is empty
                if (contact.getDisplayName() == null || contact.getDisplayName().isBlank()) {
                    contact.setDisplayName(matchedUser.getFirstName() + " " + matchedUser.getLastName());
                }

                azaUsersFound++;
            } else {
                contact.setContactUserId(null);
                contact.setIsAzaUser(false);
            }

            contact = contactRepository.save(contact);
            results.add(toContactResponse(contact));
        }

        return ContactSyncResponse.builder()
                .totalSynced(results.size())
                .azaUsersFound(azaUsersFound)
                .contacts(results)
                .build();
    }

    @Transactional
    public void deleteAllContacts(UUID userId) {
        contactRepository.deleteAllByOwnerUserId(userId);
        log.info("Deleted all contacts for user {}", userId);
    }

    // SEARCH CONTACTS

    public Page<ContactResponse> searchContacts(UUID userId, String query, int page, int size) {
        if (query == null || query.isBlank()) {
            return listContacts(userId, page, size);
        }

        // Sanitize a query — strip anything that's not alphanumeric, space, @, +, or .
        String sanitizedQuery = query.replaceAll("[^a-zA-Z0-9\\s@+.]", "").trim();

        if (sanitizedQuery.isBlank()) {
            return Page.empty();
        }

        return contactRepository.searchByOwnerUserIdAndQuery(
                        userId, sanitizedQuery, PageRequest.of(page, size))
                .map(this::toContactResponse);
    }

    //GET SINGLE CONTACT

    @Transactional
    public ContactResponse addContact(User owner, UUID targetUserId) {
        if (owner.getId().equals(targetUserId)) {
            throw new RuntimeException("You cannot add yourself as a contact");
        }

        User targetUser = userRepository.findById(targetUserId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Contact contact = findOrCreateContact(owner.getId(), targetUserId, targetUser);
        return toContactResponse(contact);
    }

    @Transactional
    public void requestContact(User sender, UUID targetUserId) {
        if (sender.getId().equals(targetUserId)) {
            throw new RuntimeException("You cannot request yourself as a contact");
        }

        if (!userRepository.existsById(targetUserId)) {
            throw new RuntimeException("User not found");
        }

        // Check if already a contact
        if (contactRepository.findByOwnerUserIdAndContactUserId(sender.getId(), targetUserId).isPresent()) {
            throw new RuntimeException("User is already a contact");
        }

        Optional<ContactRequest> existing = contactRequestRepository.findBySenderUserIdAndReceiverUserId(sender.getId(), targetUserId);
        if (existing.isPresent() && existing.get().getStatus() == ContactRequest.RequestStatus.PENDING) {
            throw new RuntimeException("Contact request already sent");
        }

        ContactRequest request = ContactRequest.builder()
                .senderUserId(sender.getId())
                .receiverUserId(targetUserId)
                .status(ContactRequest.RequestStatus.PENDING)
                .build();
        contactRequestRepository.save(request);
    }

    public List<ContactRequestResponse> getPendingRequests(UUID receiverId) {
        return contactRequestRepository.findAllByReceiverUserIdAndStatus(receiverId, ContactRequest.RequestStatus.PENDING)
                .stream()
                .map(req -> {
                    User sender = userRepository.findById(req.getSenderUserId()).orElse(null);
                    return ContactRequestResponse.builder()
                            .id(req.getId().toString())
                            .senderUserId(req.getSenderUserId().toString())
                            .receiverUserId(req.getReceiverUserId().toString())
                            .status(req.getStatus().name())
                            .senderDisplayName(sender != null ? sender.getFirstName() + " " + sender.getLastName() : "Unknown")
                            .senderUsername(sender != null ? sender.getUsername() : null)
                            .senderProfileImageUrl(sender != null ? sender.getProfileImageUrl() : null)
                            .createdAt(req.getCreatedAt() != null ? req.getCreatedAt().toString() : null)
                            .build();
                }).toList();
    }

    @Transactional
    public ContactResponse approveContactRequest(User receiver, UUID requestId) {
        ContactRequest request = contactRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));
        if (!request.getReceiverUserId().equals(receiver.getId())) {
            throw new RuntimeException("Not authorized");
        }
        if (request.getStatus() != ContactRequest.RequestStatus.PENDING) {
            throw new RuntimeException("Request already processed");
        }
        
        request.setStatus(ContactRequest.RequestStatus.APPROVED);
        contactRequestRepository.save(request);
        
        // Add each other as contacts
        addMutualContact(request.getSenderUserId(), request.getReceiverUserId());
        return toContactResponse(addMutualContact(request.getReceiverUserId(), request.getSenderUserId()));
    }

    @Transactional
    public void rejectContactRequest(User receiver, UUID requestId) {
        ContactRequest request = contactRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));
        if (!request.getReceiverUserId().equals(receiver.getId())) {
            throw new RuntimeException("Not authorized");
        }
        
        request.setStatus(ContactRequest.RequestStatus.REJECTED);
        contactRequestRepository.save(request);
    }

    private Contact findOrCreateContact(UUID ownerId, UUID targetUserId, User targetUser) {
        Optional<Contact> existing = contactRepository.findByOwnerUserIdAndContactUserId(ownerId, targetUserId);
        if (existing.isPresent()) {
            return existing.get();
        }

        if (targetUser.getPhoneNumber() != null) {
            Optional<Contact> existingByPhone = contactRepository.findByOwnerUserIdAndPhoneNumber(ownerId, targetUser.getPhoneNumber());
            if (existingByPhone.isPresent()) {
                Contact contact = existingByPhone.get();
                contact.setContactUserId(targetUserId);
                contact.setIsAzaUser(true);
                return contactRepository.save(contact);
            }
        }

        Contact contact = Contact.builder()
                .ownerUserId(ownerId)
                .contactUserId(targetUserId)
                .displayName(targetUser.getFirstName() + " " + targetUser.getLastName())
                .phoneNumber(targetUser.getPhoneNumber())
                .email(targetUser.getEmail())
                .isAzaUser(true)
                .isFavorite(false)
                .build();
        return contactRepository.save(contact);
    }

    private Contact addMutualContact(UUID ownerId, UUID contactId) {
        User targetUser = userRepository.findById(contactId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return findOrCreateContact(ownerId, contactId, targetUser);
    }

    public ContactResponse getContact(UUID userId, UUID contactId) {
        Contact contact = contactRepository.findByIdAndOwnerUserId(contactId, userId)
                .orElseThrow(() -> new RuntimeException("Contact not found"));
        return toContactResponse(contact);
    }

    // FAVORITES

    @Transactional
    public ContactResponse markFavorite(UUID userId, UUID contactId) {
        Contact contact = contactRepository.findByIdAndOwnerUserId(contactId, userId)
                .orElseThrow(() -> new RuntimeException("Contact not found"));
        contact.setIsFavorite(true);
        contact = contactRepository.save(contact);
        return toContactResponse(contact);
    }

    @Transactional
    public ContactResponse unmarkFavorite(UUID userId, UUID contactId) {
        Contact contact = contactRepository.findByIdAndOwnerUserId(contactId, userId)
                .orElseThrow(() -> new RuntimeException("Contact not found"));
        contact.setIsFavorite(false);
        contact = contactRepository.save(contact);
        return toContactResponse(contact);
    }

    // BLOCK / UNBLOCK

    @Transactional
    public void blockUser(User blocker, UUID targetUserId) {
        if (blocker.getId().equals(targetUserId)) {
            throw new RuntimeException("You cannot block yourself");
        }
        userRepository.findById(targetUserId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (blockedUserRepository.existsByBlockerIdAndBlockedUserId(blocker.getId(), targetUserId)) {
            throw new RuntimeException("User is already blocked");
        }

        blockedUserRepository.save(BlockedUser.builder()
                .blockerId(blocker.getId())
                .blockedUserId(targetUserId)
                .build());

        log.info("User {} blocked {}", blocker.getId(), targetUserId);
    }

    @Transactional
    public void unblockUser(User blocker, UUID targetUserId) {
        if (!blockedUserRepository.existsByBlockerIdAndBlockedUserId(blocker.getId(), targetUserId)) {
            throw new RuntimeException("This user is not blocked");
        }
        blockedUserRepository.deleteByBlockerIdAndBlockedUserId(blocker.getId(), targetUserId);
        log.info("User {} unblocked {}", blocker.getId(), targetUserId);
    }

    public List<BlockedUserResponse> getBlockedUsers(UUID userId) {
        return blockedUserRepository.findAllByBlockerId(userId).stream()
                .map(block -> {
                    User target = userRepository.findById(block.getBlockedUserId()).orElse(null);
                    return BlockedUserResponse.builder()
                            .blockedUserId(block.getBlockedUserId().toString())
                            .displayName(target != null
                                    ? target.getFirstName() + " " + target.getLastName() : "Unknown")
                            .username(target != null ? target.getUsername() : null)
                            .profileImageUrl(target != null ? target.getProfileImageUrl() : null)
                            .blockedAt(block.getCreatedAt() != null
                                    ? block.getCreatedAt().toString() : null)
                            .build();
                })
                .toList();
    }

    //  HELPERS

    /**
     * Normalize phone number to international format
     * Handles Ghana numbers: 0XX -> +233XX
     */
    private String normalizePhone(String phone) {
        if (phone == null) return null;
        phone = phone.replaceAll("[\\s\\-()]", ""); // remove spaces, dashes, parens

        if (phone.startsWith("0") && phone.length() == 10) {
            // Ghana local format -> international
            phone = "+233" + phone.substring(1);
        } else if (!phone.startsWith("+")) {
            phone = "+" + phone;
        }

        return phone;
    }

    /**
     * Convert a Contact entity to ContactResponse DTO.
     * Fetches profile image and handle from the linked Aza user if they exist.
     * Respects privacy settings — hides email/phone of users who opted out.
     */
    private ContactResponse toContactResponse(Contact contact) {
        String profileImageUrl = null;
        String username = null;
        String responsePhone = contact.getPhoneNumber();
        String responseEmail = contact.getEmail();

        if (Boolean.TRUE.equals(contact.getIsAzaUser()) && contact.getContactUserId() != null) {
            Optional<User> azaUser = userRepository.findById(contact.getContactUserId());
            if (azaUser.isPresent()) {
                User user = azaUser.get();

                // Only surface Aza identity if the user still allows discovery
                if (Boolean.TRUE.equals(user.getFindMeByPhone())) {
                    profileImageUrl = user.getProfileImageUrl();
                    username = user.getUsername();
                } else {
                    // User revoked discoverability — hide all identifying Aza fields
                    responsePhone = null;
                }
                if (!Boolean.TRUE.equals(user.getFindMeByEmail())) {
                    responseEmail = null;
                }
            }
        }

        return ContactResponse.builder()
                .id(contact.getId().toString())
                .contactUserId(contact.getContactUserId() != null
                        ? contact.getContactUserId().toString() : null)
                .displayName(contact.getDisplayName())
                .phoneNumber(responsePhone)
                .email(responseEmail)
                .isAzaUser(Boolean.TRUE.equals(contact.getIsAzaUser()))
                .isFavorite(Boolean.TRUE.equals(contact.getIsFavorite()))
                .profileImageUrl(profileImageUrl)
                .handle(username)
                .build();
    }
}
