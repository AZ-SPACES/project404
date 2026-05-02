package com.aza.backend.service;

import com.aza.backend.dto.notification.FcmTokenRequest;
import com.aza.backend.dto.notification.NotificationResponse;
import com.aza.backend.dto.websocket.WebSocketEventType;
import com.aza.backend.entity.FcmToken;
import com.aza.backend.entity.Notification;
import com.aza.backend.entity.User;
import com.aza.backend.repository.FcmTokenRepository;
import com.aza.backend.repository.NotificationRepository;
import com.aza.backend.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.firebase.messaging.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
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
    private final UserRepository userRepository;
    private final WebSocketPublisher webSocketPublisher;
    private final PresenceService presenceService;
    private final ObjectMapper objectMapper;

    private static final ZoneId GHANA_TZ = ZoneId.of("Africa/Accra");

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
        sendNotificationWithImage(userId, type, title, body, data, null, null);
    }

    @Transactional
    public void sendNotification(UUID userId, Notification.NotificationType type,
                                 String title, String body, Map<String, Object> data,
                                 BigDecimal paymentAmount) {
        sendNotificationWithImage(userId, type, title, body, data, paymentAmount, null);
    }

    @Transactional
    public void sendNotificationWithImage(UUID userId, Notification.NotificationType type,
                                 String title, String body, Map<String, Object> data,
                                 BigDecimal paymentAmount, String imageUrl) {
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
                .imageUrl(imageUrl)
                .build();

        notification = notificationRepository.save(notification);

        // Deliver via WebSocket if user is online
        NotificationResponse response = toNotificationResponse(notification);
        webSocketPublisher.publishNotification(
                userId, WebSocketEventType.NOTIFICATION_NEW, response);

        // Also send FCM push if user is offline — subject to silent hours gating
        if (!presenceService.isOnline(userId)) {
            sendFcmPushIfAllowed(userId, title, body, data, paymentAmount, imageUrl);
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

    public void sendPaymentRequestReceivedNotification(UUID payerId, String requesterName,
                                                        BigDecimal amount, String paymentRequestId) {
        Map<String, Object> data = new HashMap<>();
        data.put("paymentRequestId", paymentRequestId);
        data.put("type", "PAYMENT_REQUEST_RECEIVED");

        sendNotification(
                payerId,
                Notification.NotificationType.PAYMENT_REQUEST_RECEIVED,
                "Payment Request",
                requesterName + " is requesting GHS " + amount,
                data,
                amount);
    }

    public void sendPaymentRequestPaidNotification(UUID requesterId, String payerName,
                                                    BigDecimal amount, String paymentRequestId) {
        Map<String, Object> data = new HashMap<>();
        data.put("paymentRequestId", paymentRequestId);
        data.put("type", "PAYMENT_REQUEST_PAID");

        sendNotification(
                requesterId,
                Notification.NotificationType.PAYMENT_REQUEST_PAID,
                "Payment Received",
                payerName + " paid your request for GHS " + amount,
                data,
                amount);
    }

    public void sendPaymentRequestDeclinedNotification(UUID requesterId, String payerName,
                                                        BigDecimal amount, String paymentRequestId) {
        Map<String, Object> data = new HashMap<>();
        data.put("paymentRequestId", paymentRequestId);
        data.put("type", "PAYMENT_REQUEST_DECLINED");

        sendNotification(
                requesterId,
                Notification.NotificationType.PAYMENT_REQUEST_DECLINED,
                "Payment Request Declined",
                payerName + " declined your request for GHS " + amount,
                data);
    }

    public void sendPaymentRequestCancelledNotification(UUID payerId, String requesterName,
                                                         BigDecimal amount, String paymentRequestId) {
        Map<String, Object> data = new HashMap<>();
        data.put("paymentRequestId", paymentRequestId);
        data.put("type", "PAYMENT_REQUEST_CANCELLED");

        sendNotification(
                payerId,
                Notification.NotificationType.PAYMENT_REQUEST_CANCELLED,
                "Payment Request Cancelled",
                requesterName + " cancelled their request for GHS " + amount,
                data);
    }

    public void sendPaymentRequestExpiredNotification(UUID userId, BigDecimal amount,
                                                       String paymentRequestId) {
        Map<String, Object> data = new HashMap<>();
        data.put("paymentRequestId", paymentRequestId);
        data.put("type", "PAYMENT_REQUEST_EXPIRED");

        sendNotification(
                userId,
                Notification.NotificationType.PAYMENT_REQUEST_EXPIRED,
                "Payment Request Expired",
                "A payment request for GHS " + amount + " has expired",
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
    public void deleteAll(UUID userId) {
        notificationRepository.deleteAllByUserId(userId);
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

    private void sendFcmPushIfAllowed(UUID userId, String title, String body,
                                      Map<String, Object> data, BigDecimal paymentAmount, String imageUrl) {
        User user = userRepository.findById(userId).orElse(null);
        if (user != null && isSuppressedBySilentHours(user, paymentAmount)) {
            log.debug("FCM push suppressed by silent hours for user {}", userId);
            return;
        }
        sendFcmPush(userId, title, body, data, imageUrl);
    }

    private boolean isSuppressedBySilentHours(User user, BigDecimal paymentAmount) {
        if (!Boolean.TRUE.equals(user.getSilentHoursEnabled())) return false;
        if (user.getSilentHoursStart() == null || user.getSilentHoursEnd() == null) return false;

        LocalTime nowTime = ZonedDateTime.now(GHANA_TZ).toLocalTime();
        LocalTime start = LocalTime.parse(user.getSilentHoursStart());
        LocalTime end = LocalTime.parse(user.getSilentHoursEnd());

        boolean inSilentWindow;
        if (!start.isAfter(end)) {
            inSilentWindow = !nowTime.isBefore(start) && nowTime.isBefore(end);
        } else {
            // Wraps midnight, e.g. 22:00 – 07:00
            inSilentWindow = !nowTime.isBefore(start) || nowTime.isBefore(end);
        }
        if (!inSilentWindow) return false;

        // In silent window — check if payment breaks through
        if (paymentAmount != null) {
            BigDecimal threshold = user.getSilentHoursPaymentThreshold();
            if (threshold != null && paymentAmount.compareTo(threshold) >= 0) {
                return false; // payment amount meets or exceeds threshold — send it
            }
            // threshold null means no payment breaks through
        }

        return true; // suppress
    }

    /**
     * Send FCM push notification to all the user's registered devices.
     * NOTE: FirebaseMessaging.getInstance() requires Firebase Admin SDK
     * to be initialized in a @Bean on app startup.
     * See FirebaseConfig.java for setup instructions.
     */
    private void sendFcmPush(UUID userId, String title, String body,
                             Map<String, Object> data, String imageUrl) {
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
                                .setImage(imageUrl)
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
                .imageUrl(n.getImageUrl())
                .isRead(Boolean.TRUE.equals(n.getIsRead()))
                .createdAt(n.getCreatedAt() != null ? n.getCreatedAt().toString() : null)
                .build();
    }
}
