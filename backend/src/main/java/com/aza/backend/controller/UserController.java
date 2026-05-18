package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.user.DeactivateRequest;
import com.aza.backend.dto.user.PrivacySettingsRequest;
import com.aza.backend.dto.user.SilentHoursRequest;
import com.aza.backend.dto.user.UpdateProfileRequest;
import com.aza.backend.entity.User;
import com.aza.backend.service.ContactService;
import com.aza.backend.service.PresenceService;
import com.aza.backend.service.UserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final ContactService contactService;
    private final PresenceService presenceService;
    private final ObjectMapper objectMapper;

    // ==================== CURRENT USER ====================

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<Object>> getMe(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(userService.getProfile(user)));
    }

    @PutMapping("/me")
    public ResponseEntity<ApiResponse<Object>> updateMe(
            @AuthenticationPrincipal User user,
            @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(ApiResponse.success(userService.updateProfile(user, request)));
    }

    // ==================== PROFILE IMAGE ====================

    @PutMapping("/me/profile-image")
    public ResponseEntity<ApiResponse<Object>> uploadProfileImage(
            @AuthenticationPrincipal User user,
            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(ApiResponse.success(userService.uploadProfileImage(user, file)));
    }

    // ==================== PUBLIC PROFILES ====================

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Object>> getPublicProfile(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(userService.getPublicProfile(id)));
    }

    @GetMapping("/by-handle/{handle}")
    public ResponseEntity<ApiResponse<Object>> getByHandle(@PathVariable String handle) {
        return ResponseEntity.ok(ApiResponse.success(userService.getPublicProfileByUsername(handle)));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<org.springframework.data.domain.Page<com.aza.backend.dto.user.PublicProfileResponse>>> searchUsers(
            @RequestParam String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(userService.searchUsers(q, page, size)));
    }

    // ==================== ONLINE STATUS ====================

    @GetMapping("/{id}/status")
    public ResponseEntity<ApiResponse<String>> getOnlineStatus(@PathVariable UUID id) {
        return ResponseEntity.ok(ApiResponse.success(presenceService.getStatus(id)));
    }

    // ==================== PRIVACY ====================

    @PutMapping("/me/privacy")
    public ResponseEntity<ApiResponse<Object>> updatePrivacy(
            @AuthenticationPrincipal User user,
            @RequestBody PrivacySettingsRequest request) {
        userService.updatePrivacySettings(user, request);
        return ResponseEntity.ok(ApiResponse.success("Privacy settings updated"));
    }

    @DeleteMapping("/me/privacy")
    public ResponseEntity<ApiResponse<Object>> removeSelfEverywhere(
            @AuthenticationPrincipal User user) {
        userService.removeSelfEverywhere(user);
        contactService.deleteAllContacts(user.getId());
        return ResponseEntity.ok(ApiResponse.success("Removed from all discovery and contact lists"));
    }

    // ==================== NOTIFICATIONS ====================

    @PutMapping("/me/notifications")
    public ResponseEntity<ApiResponse<Object>> updateNotifications(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, Object> preferences) {
        String json = objectMapper.valueToTree(preferences).toString();

        if (json.length() > 2048) {
            return ResponseEntity.badRequest().body(
                    ApiResponse.error("BAD_REQUEST", "Notification preferences too large (max 2048 chars)"));
        }

        userService.updateNotificationPreferences(user, json);
        return ResponseEntity.ok(ApiResponse.success("Notification preferences updated"));
    }

    // ==================== DEACTIVATE ====================

    @PostMapping("/me/deactivate")
    public ResponseEntity<ApiResponse<Object>> deactivate(
            @AuthenticationPrincipal User user,
            @RequestBody DeactivateRequest request,
            HttpServletRequest httpRequest) {
        String token = httpRequest.getHeader("Authorization");
        userService.deactivateAccount(user, request, token);
        return ResponseEntity.ok(ApiResponse.success("Account deactivated"));
    }

    // ==================== SILENT HOURS ====================

    @PutMapping("/me/silent-hours")
    public ResponseEntity<ApiResponse<Object>> updateSilentHours(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody SilentHoursRequest request) {
        userService.updateSilentHours(user, request);
        return ResponseEntity.ok(ApiResponse.success("Silent hours updated"));
    }

    // ==================== DEVICES ====================

    @GetMapping("/me/devices")
    public ResponseEntity<ApiResponse<Object>> getDevices(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(ApiResponse.success(userService.getDevices(user)));
    }

    @DeleteMapping("/me/devices/{id}")
    public ResponseEntity<ApiResponse<Object>> removeDevice(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        userService.removeDevice(user, id);
        return ResponseEntity.ok(ApiResponse.success("Device removed"));
    }

    // ==================== EMAIL & PHONE CHANGE ====================

    @PostMapping("/me/email/request")
    public ResponseEntity<ApiResponse<Object>> requestEmailChange(
            @AuthenticationPrincipal User user,
            @RequestParam String email) {
        userService.requestEmailChange(user, email);
        return ResponseEntity.ok(ApiResponse.success("OTP sent to your new email"));
    }

    @PostMapping("/me/email/verify")
    public ResponseEntity<ApiResponse<Object>> verifyEmailChange(
            @AuthenticationPrincipal User user,
            @RequestBody com.aza.backend.dto.auth.OtpVerifyRequest request) {
        return ResponseEntity.ok(ApiResponse.success(userService.verifyEmailChange(user, request.getIdentifier(), request.getCode())));
    }

    @PostMapping("/me/phone/request")
    public ResponseEntity<ApiResponse<Object>> requestPhoneChange(
            @AuthenticationPrincipal User user,
            @RequestParam String phone) {
        userService.requestPhoneChange(user, phone);
        return ResponseEntity.ok(ApiResponse.success("OTP sent to your new phone number"));
    }

    @PostMapping("/me/phone/verify")
    public ResponseEntity<ApiResponse<Object>> verifyPhoneChange(
            @AuthenticationPrincipal User user,
            @RequestBody com.aza.backend.dto.auth.OtpVerifyRequest request) {
        return ResponseEntity.ok(ApiResponse.success(userService.verifyPhoneChange(user, request.getIdentifier(), request.getCode())));
    }

    // ==================== HANDLES (PUBLIC) ====================

    @GetMapping("/check-handle")
    public ResponseEntity<ApiResponse<Boolean>> checkHandle(@RequestParam String handle) {
        return ResponseEntity.ok(ApiResponse.success(userService.isUsernameAvailable(handle)));
    }

    @GetMapping("/check-email")
    public ResponseEntity<ApiResponse<Boolean>> checkEmail(@RequestParam String email) {
        return ResponseEntity.ok(ApiResponse.success(userService.isEmailAvailable(email)));
    }

    @GetMapping("/check-phone")
    public ResponseEntity<ApiResponse<Boolean>> checkPhone(@RequestParam String phone) {
        return ResponseEntity.ok(ApiResponse.success(userService.isPhoneAvailable(phone)));
    }

    @GetMapping("/suggest-handles")
    public ResponseEntity<ApiResponse<java.util.List<String>>> suggestUsernames(
            @RequestParam String firstName,
            @RequestParam String lastName) {
        return ResponseEntity.ok(ApiResponse.success(userService.suggestUsernames(firstName, lastName)));
    }
}
