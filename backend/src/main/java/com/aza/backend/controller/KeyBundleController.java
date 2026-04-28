package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.e2ee.KeyBundleResponse;
import com.aza.backend.dto.e2ee.KeyBundleUploadRequest;
import com.aza.backend.dto.e2ee.OtpkReplenishRequest;
import com.aza.backend.entity.User;
import com.aza.backend.service.KeyBundleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class KeyBundleController {

    private final KeyBundleService keyBundleService;

    /**
     * PUT /api/v1/users/me/key-bundle
     * Upload or rotate the authenticated user's public key bundle.
     * Called on initial app setup and during weekly SPK rotation.
     */
    @PutMapping("/api/v1/users/me/key-bundle")
    public ResponseEntity<ApiResponse<Map<String, Object>>> uploadKeyBundle(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody KeyBundleUploadRequest request) {

        keyBundleService.uploadKeyBundle(user, request);

        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "message", "Key bundle uploaded successfully",
                "opkCount", request.getOneTimePreKeys().size()
        )));
    }

    /**
     * GET /api/v1/users/{id}/key-bundle
     * Fetch a recipient's public key bundle to initiate an E2EE session.
     * Pops one OPK from the recipient's supply — truly one-time use.
     */
    @GetMapping("/api/v1/users/{id}/key-bundle")
    public ResponseEntity<ApiResponse<KeyBundleResponse>> getKeyBundle(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {

        // Can't fetch your own key bundle for session initiation
        if (id.equals(user.getId())) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("BAD_REQUEST",
                            "Cannot fetch your own key bundle for session initiation"));
        }

        KeyBundleResponse response = keyBundleService.fetchKeyBundle(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * POST /api/v1/users/me/one-time-prekeys
     * Replenish one-time pre-keys when supply is low.
     * Called after server notifies client via WebSocket that OPKs are running low.
     */
    @PostMapping("/api/v1/users/me/one-time-prekeys")
    public ResponseEntity<ApiResponse<Map<String, Object>>> replenishOtpks(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody OtpkReplenishRequest request) {

        int totalCount = keyBundleService.replenishOtpks(user, request);

        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "message", "One-time pre-keys replenished",
                "totalCount", totalCount
        )));
    }

    /**
     * GET /api/v1/users/me/key-bundle/status
     * Check the current OPK count and key bundle status.
     */
    @GetMapping("/api/v1/users/me/key-bundle/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getKeyBundleStatus(
            @AuthenticationPrincipal User user) {

        int opkCount = keyBundleService.getOpkCount(user);
        boolean hasKeyBundle = user.getIdentityPublicKey() != null;

        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "hasKeyBundle", hasKeyBundle,
                "opkCount", opkCount,
                "needsReplenishment", opkCount < 10
        )));
    }
}
