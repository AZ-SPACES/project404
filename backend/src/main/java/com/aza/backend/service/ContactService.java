package com.aza.backend.service;

import com.aza.backend.dto.contact.*;
import com.aza.backend.entity.Contact;
import com.aza.backend.entity.User;
import com.aza.backend.repository.ContactRepository;
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
            if (phone.equals(owner.getPhone())) {
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
            Optional<User> azaUser = userRepository.findByPhone(phone);
            if (azaUser.isPresent() && Boolean.TRUE.equals(azaUser.get().getFindMeByPhone())) {
                User matchedUser = azaUser.get();
                contact.setContactUserId(matchedUser.getId());
                contact.setIsAzaUser(true);

                // Use Aza display name if device contact name is empty
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

    // SEARCH CONTACTS

    public Page<ContactResponse> searchContacts(UUID userId, String query, int page, int size) {
        if (query == null || query.isBlank()) {
            return listContacts(userId, page, size);
        }

        // Sanitize query — strip anything that's not alphanumeric, space, @, +, or .
        String sanitizedQuery = query.replaceAll("[^a-zA-Z0-9\\s@+.]", "").trim();

        if (sanitizedQuery.isBlank()) {
            return Page.empty();
        }

        return contactRepository.searchByOwnerUserIdAndQuery(
                        userId, sanitizedQuery, PageRequest.of(page, size))
                .map(this::toContactResponse);
    }

    //GET SINGLE CONTACT

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
        String handle = null;
        String responsePhone = contact.getPhoneNumber();
        String responseEmail = contact.getEmail();

        if (Boolean.TRUE.equals(contact.getIsAzaUser()) && contact.getContactUserId() != null) {
            Optional<User> azaUser = userRepository.findById(contact.getContactUserId());
            if (azaUser.isPresent()) {
                User user = azaUser.get();
                profileImageUrl = user.getProfileImageUrl();
                handle = user.getHandle();

                // Respect privacy — hide phone/email if user opted out
                if (!Boolean.TRUE.equals(user.getFindMeByPhone())) {
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
                .handle(handle)
                .build();
    }
}
