package com.aza.backend.service;

import com.aza.backend.dto.notification.FcmTokenRequest;
import com.aza.backend.dto.notification.NotificationResponse;
import com.aza.backend.dto.websocket.WebSocketEventType;
import com.aza.backend.entity.FcmToken;
import com.aza.backend.entity.Notification;
import com.aza.backend.repository.FcmTokenRepository;
import com.aza.backend.repository.NotificationRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.firebase.messaging.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final FcmTokenRepository fcmTokenRepository;
    private final NotificationRepository notificationRepository;
    private final WebSocketPublisher webSocketPublisher;
    private final PresenceService presenceService;
    private final ObjectMapper objectMapper;

    //  FCM TOKEN MANAGEMENT

    @Transactional
    public void registerFcmToken(UUID userId, FcmTokenRequest request) {
        // Upsert — update if device already registered, otherwise create
        fcmTokenRepository.findByUserIdAndDeviceId(userId, request.getDeviceId())
                .ifPresentOrElse(existing -> {
                    existing.setToken(request.getToken());
                    existing.setLastUsedAt(LocalDateTime.now());
                    fcmTokenRepository.save(existing);
                }, () -> {
                    FcmToken token = FcmToken.builder()
                            .userId(userId)
                            .token(request.getToken())
                            .deviceId(request.getDeviceId())
                            .deviceName(request.getDeviceName())
                            .platform(request.getPlatform())
                            .build();
                    fcmTokenRepository.save(token);
                });

        log.info("FCM token registered for user {} on device {}", userId, request.getDeviceId());
    }

    @Transactional
    public void unregisterFcmToken(UUID userId, String deviceId) {
        fcmTokenRepository.findByUserIdAndDeviceId(userId, deviceId)
                .ifPresent(fcmTokenRepository::delete);
    }

    // SEND NOTIFICATION

    /**
     * Create an in-app notification and optionally send a push notification.
     * If the user is online (WebSocket connected), delivers via WebSocket only.
     * If offline, sends FCM push notification to all their devices.
     */
    @Transactional
    public void sendNotification(UUID userId, Notification.NotificationType type,
                                 String title, String body, Map<String, Object> data) {
        // Save in-app notification
        String dataJson = null;
        try {
            if (data != null) dataJson = objectMapper.writeValueAsString(data);
        } catch (Exception e) {
            log.warn("Failed to serialize notification data: {}", e.getMessage());
        }

        Notification notification = Notification.builder()
                .userId(userId)
                .type(type)
                .title(title)
                .body(body)
                .data(dataJson)
                .build();

        notification = notificationRepository.save(notification);

        // Deliver via WebSocket if user is online
        NotificationResponse response = toNotificationResponse(notification);
        webSocketPublisher.publishNotification(
                userId, WebSocketEventType.NOTIFICATION_NEW, response);

        // Also send FCM push if user is offline — ensures they see it
        if (!presenceService.isOnline(userId)) {
            sendFcmPush(userId, title, body, data);
        }
    }

    //CONVENIENCE METHODS

    public void sendNewMessageNotification(UUID recipientId, String senderName, String chatId) {
        Map<String, Object> data = new HashMap<>();
        data.put("chatId", chatId);
        data.put("type", "NEW_MESSAGE");

        sendNotification(
                recipientId,
                Notification.NotificationType.NEW_MESSAGE,
                senderName,
                "Sent you a message",
                data);
    }

    public void sendIncomingCallNotification(UUID recipientId, String callerName,
                                              String callId, boolean isVideo) {
        Map<String, Object> data = new HashMap<>();
        data.put("callId", callId);
        data.put("isVideo", isVideo);

        sendNotification(
                recipientId,
                Notification.NotificationType.INCOMING_CALL,
                (isVideo ? "Incoming video call" : "Incoming call"),
                callerName + " is calling you",
                data);
    }

    public void sendMissedCallNotification(UUID recipientId, String callerName,
                                           String callId, boolean isVideo) {
        Map<String, Object> data = new HashMap<>();
        data.put("callId", callId);
        data.put("isVideo", isVideo);

        sendNotification(
                recipientId,
                Notification.NotificationType.MISSED_CALL,
                "Missed " + (isVideo ? "video" : "voice") + " call",
                callerName + " called you",
                data);
    }

    public void sendMoneyReceivedNotification(UUID recipientId, String senderName,
                                              String amount, String transactionId) {
        Map<String, Object> data = new HashMap<>();
        data.put("transactionId", transactionId);
        data.put("type", "MONEY_RECEIVED");

        sendNotification(
                recipientId,
                Notification.NotificationType.MONEY_RECEIVED,
                "Money Received",
                "You received GHS " + amount + " from " + senderName,
                data);
    }

    public void sendMoneyRequestNotification(UUID recipientId, String requesterName,
                                             String amount, String transactionId) {
        Map<String, Object> data = new HashMap<>();
        data.put("transactionId", transactionId);
        data.put("type", "MONEY_REQUESTED");

        sendNotification(
                recipientId,
                Notification.NotificationType.MONEY_REQUESTED,
                "Money Request",
                requesterName + " is requesting GHS " + amount,
                data);
    }

    public void sendSecurityAlert(UUID userId, String deviceName, String ipAddress) {
        Map<String, Object> data = new HashMap<>();
        data.put("type", "SECURITY_ALERT");
        data.put("deviceName", deviceName);
        data.put("ipAddress", ipAddress);

        sendNotification(
                userId,
                Notification.NotificationType.SECURITY_ALERT,
                "New Sign-in Detected",
                "Your account was accessed from " + deviceName,
                data);
    }

    // IN-APP NOTIFICATION INBOX

    public Page<NotificationResponse> getNotifications(UUID userId, int page, int size) {
        int cappedSize = Math.min(size, 50);
        return notificationRepository
                .findAllByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(page, cappedSize))
                .map(this::toNotificationResponse);
    }

    public long getUnreadCount(UUID userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    @Transactional
    public void markAllAsRead(UUID userId) {
        notificationRepository.markAllAsRead(userId);
    }

    @Transactional
    public void markAsRead(UUID userId, UUID notificationId) {
        notificationRepository.findById(notificationId).ifPresent(notification -> {
            if (!notification.getUserId().equals(userId)) {
                throw new RuntimeException("Not authorized");
            }
            notification.setIsRead(true);
            notificationRepository.save(notification);
        });
    }

    // FCM PUSH

    /**
     * Send FCM push notification to all the user's registered devices.
     * NOTE: FirebaseMessaging.getInstance() requires Firebase Admin SDK
     * to be initialized in a @Bean on app startup.
     * See FirebaseConfig.java for setup instructions.
     */
    private void sendFcmPush(UUID userId, String title, String body,
                             Map<String, Object> data) {
        if (com.google.firebase.FirebaseApp.getApps().isEmpty()) {
            log.debug("Firebase not initialised — skipping push for user {}", userId);
            return;
        }
        List<FcmToken> tokens = fcmTokenRepository.findAllByUserId(userId);
        if (tokens.isEmpty()) return;

        for (FcmToken fcmToken : tokens) {
            try {
                // Convert data map to String map for FCM
                Map<String, String> fcmData = new HashMap<>();
                if (data != null) {
                    data.forEach((k, v) -> fcmData.put(k, String.valueOf(v)));
                }

                com.google.firebase.messaging.Notification fcmNotification =
                        com.google.firebase.messaging.Notification.builder()
                                .setTitle(title)
                                .setBody(body)
                                .build();

                Message message = Message.builder()
                        .setToken(fcmToken.getToken())
                        .setNotification(fcmNotification)
                        .putAllData(fcmData)
                        .build();

                String response = FirebaseMessaging.getInstance().send(message);
                log.debug("FCM push sent to device {}: {}", fcmToken.getDeviceId(), response);

                // Update last used
                fcmToken.setLastUsedAt(LocalDateTime.now());
                fcmTokenRepository.save(fcmToken);

            } catch (FirebaseMessagingException e) {
                // Token is invalid/expired — remove it
                if (e.getMessagingErrorCode() == MessagingErrorCode.UNREGISTERED) {
                    fcmTokenRepository.delete(fcmToken);
                    log.info("Removed stale FCM token for device {}", fcmToken.getDeviceId());
                } else {
                    log.error("FCM push failed for device {}: {}",
                            fcmToken.getDeviceId(), e.getMessage());
                }
            }
        }
    }

    //  HELPER

    private NotificationResponse toNotificationResponse(Notification n) {
        return NotificationResponse.builder()
                .id(n.getId().toString())
                .type(n.getType().name())
                .title(n.getTitle())
                .body(n.getBody())
                .data(n.getData())
                .isRead(Boolean.TRUE.equals(n.getIsRead()))
                .createdAt(n.getCreatedAt() != null ? n.getCreatedAt().toString() : null)
                .build();
    }
}
