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

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class KeyBundleController {

    private final KeyBundleService keyBundleService;

    /**
     * PUT /api/v1/users/me/key-bundle
     * Register or rotate this device's public key bundle.
     */
    @PutMapping("/api/v1/users/me/key-bundle")
    public ResponseEntity<ApiResponse<Map<String, Object>>> uploadKeyBundle(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody KeyBundleUploadRequest request) {

        keyBundleService.uploadKeyBundle(user, request);
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "message", "Key bundle uploaded successfully",
                "deviceId", request.getDeviceId(),
                "opkCount", request.getOneTimePreKeys().size()
        )));
    }

    /**
     * GET /api/v1/users/{id}/key-bundle
     * Fetch the most-recently-updated bundle for a recipient (single device,
     * backward-compatible). Pops one OPK.
     */
    @GetMapping("/api/v1/users/{id}/key-bundle")
    public ResponseEntity<ApiResponse<KeyBundleResponse>> getKeyBundle(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {

        if (id.equals(user.getId())) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("BAD_REQUEST",
                            "Cannot fetch your own key bundle for session initiation"));
        }

        KeyBundleResponse response = keyBundleService.fetchKeyBundle(user.getId(), id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    /**
     * GET /api/v1/users/{id}/key-bundles
     * Fetch ALL device bundles for a recipient. Each entry has one OPK popped.
     * Clients use this to encrypt one envelope per device in a single send.
     */
    @GetMapping("/api/v1/users/{id}/key-bundles")
    public ResponseEntity<ApiResponse<List<KeyBundleResponse>>> getAllKeyBundles(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {

        if (id.equals(user.getId())) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("BAD_REQUEST",
                            "Use /key-bundles/own to fetch your own device list"));
        }

        List<KeyBundleResponse> responses = keyBundleService.fetchAllKeyBundles(user.getId(), id);
        return ResponseEntity.ok(ApiResponse.success(responses));
    }

    /**
     * GET /api/v1/users/me/key-bundles/own
     * Returns the authenticated user's own device bundles WITHOUT popping any
     * OPK. Used by the sender to encrypt a copy for their own other devices.
     */
    @GetMapping("/api/v1/users/me/key-bundles/own")
    public ResponseEntity<ApiResponse<List<KeyBundleResponse>>> getOwnBundles(
            @AuthenticationPrincipal User user) {

        List<KeyBundleResponse> bundles = keyBundleService.fetchOwnBundles(user.getId());
        return ResponseEntity.ok(ApiResponse.success(bundles));
    }

    /**
     * POST /api/v1/users/me/one-time-prekeys
     * Replenish one-time pre-keys for a specific device.
     */
    @PostMapping("/api/v1/users/me/one-time-prekeys")
    public ResponseEntity<ApiResponse<Map<String, Object>>> replenishOtpks(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody OtpkReplenishRequest request) {

        int totalCount = keyBundleService.replenishOtpks(user, request);
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "message", "One-time pre-keys replenished",
                "deviceId", request.getDeviceId(),
                "totalCount", totalCount
        )));
    }

    /**
     * GET /api/v1/users/me/key-bundle/status
     * Reports whether any device bundle exists and aggregate OPK count.
     */
    @GetMapping("/api/v1/users/me/key-bundle/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getKeyBundleStatus(
            @AuthenticationPrincipal User user) {

        boolean hasKeyBundle = keyBundleService.hasKeyBundle(user.getId());
        int opkCount = keyBundleService.getOpkCount(user.getId());

        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "hasKeyBundle", hasKeyBundle,
                "opkCount", opkCount,
                "needsReplenishment", opkCount < 10
        )));
    }
}
