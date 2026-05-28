package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.auth.AccountRecoveryContactResponse;
import com.aza.backend.dto.auth.AuthResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.AccountRecoveryContactService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth/recovery-contact")
@RequiredArgsConstructor
public class AccountRecoveryContactController {

    private final AccountRecoveryContactService service;

    // ── Manage contacts (authenticated) ──────────────────────────────────────

    @GetMapping
    public ResponseEntity<ApiResponse<List<AccountRecoveryContactResponse>>> getMyContacts(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(service.getMyContacts(user)));
    }

    @GetMapping("/pending-invitations")
    public ResponseEntity<ApiResponse<List<AccountRecoveryContactResponse>>> getPendingInvitations(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(service.getPendingInvitations(user)));
    }

    @PostMapping("/invite")
    public ResponseEntity<ApiResponse<AccountRecoveryContactResponse>> invite(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, String> body) {
        UUID contactUserId = UUID.fromString(body.get("contactUserId"));
        return ResponseEntity.ok(ApiResponse.success(service.inviteContact(user, contactUserId)));
    }

    /**
     * Accept a recovery contact invitation.
     * Response includes a one-time TOTP secret — the client must store it in SecureStore.
     * It is never re-sent; if lost, the contact must be removed and re-invited.
     */
    @PostMapping("/{entryId}/accept")
    public ResponseEntity<ApiResponse<AccountRecoveryContactResponse>> accept(
            @AuthenticationPrincipal User user,
            @PathVariable UUID entryId) {
        AccountRecoveryContactResponse response = service.acceptInvitation(user, entryId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/{entryId}/decline")
    public ResponseEntity<ApiResponse<Void>> decline(
            @AuthenticationPrincipal User user,
            @PathVariable UUID entryId) {
        service.declineInvitation(user, entryId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @DeleteMapping("/{entryId}")
    public ResponseEntity<ApiResponse<Void>> remove(
            @AuthenticationPrincipal User user,
            @PathVariable UUID entryId) {
        service.removeContact(user, entryId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @DeleteMapping("/{entryId}/as-contact")
    public ResponseEntity<ApiResponse<Void>> removeAsContact(
            @AuthenticationPrincipal User user,
            @PathVariable UUID entryId) {
        service.removeAsContact(user, entryId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    // ── Recovery flow (uses preAuthToken — locked-out user) ──────────────────

    @GetMapping("/available")
    public ResponseEntity<ApiResponse<List<AccountRecoveryContactResponse>>> getAvailable(
            @RequestParam String preAuthToken) {
        return ResponseEntity.ok(ApiResponse.success(service.getActiveContactsForPreAuth(preAuthToken)));
    }

    @PostMapping("/request")
    public ResponseEntity<ApiResponse<String>> request(
            @RequestParam String preAuthToken,
            @RequestParam UUID entryId,
            HttpServletRequest httpRequest) {
        String requestId = service.requestRecovery(preAuthToken, entryId, httpRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.success(requestId));
    }

    @PostMapping("/redeem")
    public ResponseEntity<ApiResponse<AuthResponse>> redeem(
            @RequestParam String preAuthToken,
            @RequestParam UUID requestId,
            @RequestBody Map<String, String> body,
            HttpServletRequest httpRequest) {
        AuthResponse auth = service.redeemRotatingCode(
                preAuthToken, requestId, body.get("code"), httpRequest.getRemoteAddr());
        return ResponseEntity.ok(ApiResponse.success(auth));
    }
}
