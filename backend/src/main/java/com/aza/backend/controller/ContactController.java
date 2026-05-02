package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.contact.BlockedUserResponse;
import com.aza.backend.dto.contact.ContactResponse;
import com.aza.backend.dto.contact.ContactSyncRequest;
import com.aza.backend.dto.contact.ContactSyncResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.ContactService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/contacts")
@RequiredArgsConstructor
public class ContactController {

    private final ContactService contactService;

    /**
     * GET /api/v1/contacts
     * List user's contacts (paginated, Aza users first, favorites first)
     */
    @GetMapping
    public ResponseEntity<ApiResponse<Page<ContactResponse>>> listContacts(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                contactService.listContacts(user.getId(), page, size)));
    }

    /**
     * POST /api/v1/contacts/sync     *  device contacts — match phone numbers to Aza users
     */
    @PostMapping("/sync")
    public ResponseEntity<ApiResponse<ContactSyncResponse>> syncContacts(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody ContactSyncRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                contactService.syncContacts(user, request)));
    }

    /**
     * DELETE /api/v1/contacts/sync
     * Wipe all synced contacts for the user.
     */
    @DeleteMapping("/sync")
    public ResponseEntity<ApiResponse<String>> unsyncContacts(
            @AuthenticationPrincipal User user) {
        contactService.deleteAllContacts(user.getId());
        return ResponseEntity.ok(ApiResponse.success("All contacts unsynced and deleted"));
    }

    /**
     * GET /api/v1/contacts/search?q=query
     * Search contacts by name, phone, email, or handle
     */
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<Page<ContactResponse>>> searchContacts(
            @AuthenticationPrincipal User user,
            @RequestParam String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                contactService.searchContacts(user.getId(), q, page, size)));
    }

    /**
     * GET /api/v1/contacts/{id}
     * Get a single contact detail (ownership verified)
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ContactResponse>> getContact(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(
                contactService.getContact(user.getId(), id)));
    }

    /**
     * POST /api/v1/contacts/{id}/favorite
     * Mark a contact as favorite
     */
    @PostMapping("/{id}/favorite")
    public ResponseEntity<ApiResponse<ContactResponse>> markFavorite(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(
                contactService.markFavorite(user.getId(), id)));
    }

    /**
     * DELETE /api/v1/contacts/{id}/favorite
     * Unmark a contact as favorite
     */
    @DeleteMapping("/{id}/favorite")
    public ResponseEntity<ApiResponse<ContactResponse>> unmarkFavorite(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(
                contactService.unmarkFavorite(user.getId(), id)));
    }

    // ── Block / Unblock ───────────────────────────────────────────────────────

    /**
     * POST /api/v1/contacts/block/{userId}
     * Block a user — prevents them from messaging or calling you.
     */
    @PostMapping("/block/{userId}")
    public ResponseEntity<ApiResponse<String>> blockUser(
            @AuthenticationPrincipal User user,
            @PathVariable UUID userId) {
        contactService.blockUser(user, userId);
        return ResponseEntity.ok(ApiResponse.success("User blocked"));
    }

    /**
     * POST /api/v1/contacts/add/{targetUserId}
     * Add an Aza user as a contact manually.
     */
    @PostMapping("/add/{targetUserId}")
    public ResponseEntity<ApiResponse<ContactResponse>> addContact(
            @AuthenticationPrincipal User user,
            @PathVariable UUID targetUserId) {
        return ResponseEntity.ok(ApiResponse.success(
                contactService.addContact(user, targetUserId)));
    }

    /**
     * DELETE /api/v1/contacts/block/{userId}
     * Unblock a previously blocked user.
     */
    @DeleteMapping("/block/{userId}")
    public ResponseEntity<ApiResponse<String>> unblockUser(
            @AuthenticationPrincipal User user,
            @PathVariable UUID userId) {
        contactService.unblockUser(user, userId);
        return ResponseEntity.ok(ApiResponse.success("User unblocked"));
    }

    /**
     * GET /api/v1/contacts/blocked
     * List all users you have blocked.
     */
    @GetMapping("/blocked")
    public ResponseEntity<ApiResponse<List<BlockedUserResponse>>> getBlockedUsers(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(
                contactService.getBlockedUsers(user.getId())));
    }
}
