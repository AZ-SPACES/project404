package com.aza.backend.controller;

import com.aza.backend.dto.ApiResponse;
import com.aza.backend.dto.notification.FcmTokenRequest;
import com.aza.backend.dto.notification.NotificationResponse;
import com.aza.backend.entity.User;
import com.aza.backend.service.NotificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    /**
     * POST /api/v1/notifications/fcm-token
     * Register or update FCM push token for the current device.
     * Called on app startup after Firebase SDK initializes.
     */
    @PostMapping("/fcm-token")
    public ResponseEntity<ApiResponse<String>> registerFcmToken(
            @AuthenticationPrincipal User user,
            @Valid @RequestBody FcmTokenRequest request) {
        notificationService.registerFcmToken(user.getId(), request);
        return ResponseEntity.ok(ApiResponse.success("FCM token registered"));
    }

    /**
     * DELETE /api/v1/notifications/fcm-token/{deviceId}
     * Unregister FCM token when user logs out from device.
     */
    @DeleteMapping("/fcm-token/{deviceId}")
    public ResponseEntity<ApiResponse<String>> unregisterFcmToken(
            @AuthenticationPrincipal User user,
            @PathVariable String deviceId) {
        notificationService.unregisterFcmToken(user.getId(), deviceId);
        return ResponseEntity.ok(ApiResponse.success("FCM token removed"));
    }

    /**
     * GET /api/v1/notifications
     * Get paginated in-app notification inbox.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<Page<NotificationResponse>>> getNotifications(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                notificationService.getNotifications(user.getId(), page, size)));
    }

    /**
     * GET /api/v1/notifications/unread-count
     * Get count of unread notifications.
     */
    @GetMapping("/unread-count")
    public ResponseEntity<ApiResponse<Map<String, Long>>> getUnreadCount(
            @AuthenticationPrincipal User user) {
        long count = notificationService.getUnreadCount(user.getId());
        return ResponseEntity.ok(ApiResponse.success(Map.of("unreadCount", count)));
    }

    /**
     * PUT /api/v1/notifications/read-all
     * Mark all notifications as read.
     */
    @PutMapping("/read-all")
    public ResponseEntity<ApiResponse<String>> markAllAsRead(
            @AuthenticationPrincipal User user) {
        notificationService.markAllAsRead(user.getId());
        return ResponseEntity.ok(ApiResponse.success("All notifications marked as read"));
    }

    /**
     * PUT /api/v1/notifications/{id}/read
     * Mark a specific notification as read.
     */
    @PutMapping("/{id}/read")
    public ResponseEntity<ApiResponse<String>> markAsRead(
            @AuthenticationPrincipal User user,
            @PathVariable UUID id) {
        notificationService.markAsRead(user.getId(), id);
        return ResponseEntity.ok(ApiResponse.success("Notification marked as read"));
    }
}
