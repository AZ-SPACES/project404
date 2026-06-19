package com.aza.backend.service;

import com.aza.backend.dto.chat.*;
import com.aza.backend.dto.e2ee.DeviceCiphertextDto;
import com.aza.backend.dto.websocket.WebSocketEventType;
import com.aza.backend.entity.Chat;
import com.aza.backend.entity.ChatMessage;
import com.aza.backend.entity.MessageCiphertext;
import com.aza.backend.entity.User;
import com.aza.backend.dto.chat.PaymentRequestResponse;
import com.aza.backend.repository.BlockedUserRepository;
import com.aza.backend.repository.ChatMessageRepository;
import com.aza.backend.repository.ChatRepository;
import com.aza.backend.repository.MessageCiphertextRepository;
import com.aza.backend.repository.PaymentRequestRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.util.CloudinaryService;
import com.aza.backend.util.RateLimitService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.RejectedExecutionException;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import com.aza.backend.exception.AppException;
import com.aza.backend.dto.e2ee.DeviceCiphertextDto;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatService {

    private final ChatRepository chatRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final MessageCiphertextRepository messageCiphertextRepository;
    private final UserRepository userRepository;
    private final WebSocketPublisher webSocketPublisher;
    private final PresenceService presenceService;
    private final NotificationService notificationService;
    private final CloudinaryService cloudinaryService;
    private final RateLimitService rateLimitService;
    private final BlockedUserRepository blockedUserRepository;
    private final PaymentRequestRepository paymentRequestRepository;

    private static final int MESSAGE_EDIT_WINDOW_MINUTES = 15;

    private static final long   MAX_MEDIA_SIZE   = 25L * 1024 * 1024; // 25 MB
    private static final List<String> ALLOWED_MEDIA_TYPES = List.of(
            "image/jpeg", "image/png", "image/gif",
            "video/mp4",
            "audio/mpeg", "audio/mp4", "audio/aac",
            "application/pdf"
    );
    // Content-type-only fallback — no reliable magic bytes for these
    private static final Set<String> MAGIC_BYTES_FALLBACK = Set.of("audio/aac");

    // ==================== LIST CHATS ====================

    public List<ChatResponse> listChats(User user) {
        List<Chat> chats = chatRepository.findAllByUserId(user.getId());
        return chats.stream()
                .map(chat -> toChatResponse(chat, user.getId()))
                .toList();
    }

    // ==================== GET OR CREATE CHAT ====================

    @Transactional
    public ChatResponse getOrCreateChat(User user, UUID otherUserId) {
        if (user.getId().equals(otherUserId)) {
            throw new AppException("Cannot create a chat with yourself");
        }

        userRepository.findById(otherUserId)
                .orElseThrow(() -> new AppException("User not found"));

        // Find an existing chat or create a new one
        Chat chat = chatRepository.findByParticipants(user.getId(), otherUserId)
                .orElseGet(() -> {
                    Chat newChat = Chat.builder()
                            .participantOneId(user.getId())
                            .participantTwoId(otherUserId)
                            .build();
                    return chatRepository.save(newChat);
                });

        return toChatResponse(chat, user.getId());
    }

    // ==================== GET CHAT ====================

    public ChatResponse getChat(User user, UUID chatId) {
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new AppException("Chat not found"));

        assertParticipant(chat, user.getId());
        return toChatResponse(chat, user.getId());
    }

    // ==================== SEND MESSAGE ====================

    @Transactional
    public MessageResponse sendMessage(User sender, SendMessageRequest request) {
        Chat chat = chatRepository.findById(request.getChatId())
                .orElseThrow(() -> new AppException("Chat not found"));

        return sendMessage(sender, chat, request);
    }

    @Transactional
    public MessageResponse sendMessage(User sender, Chat chat, SendMessageRequest request) {
        long startNanos = System.nanoTime();
        assertParticipant(chat, sender.getId());

        UUID recipientId = getOtherParticipantId(chat, sender.getId());

        // Enforce block in both directions in a single query (non-support chats).
        if (!chat.isSupport() && blockedUserRepository.existsBlockBetween(sender.getId(), recipientId)) {
            throw new AppException("You cannot send messages to this user");
        }

        // Validate a message type
        ChatMessage.MessageType messageType;
        try {
            messageType = ChatMessage.MessageType.valueOf(request.getType().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new AppException("Invalid message type: " + request.getType());
        }

        // Compute expiry for disappearing messages
        LocalDateTime expiresAt = null;
        if (chat.getDisappearingMessagesTtl() != null && chat.getDisappearingMessagesTtl() > 0) {
            expiresAt = LocalDateTime.now().plusSeconds(chat.getDisappearingMessagesTtl());
        }

        // Cap clientId length defensively. Caller is expected to send a
        // short random identifier; longer values are truncated rather than
        // rejected so a malformed client doesn't block sending.
        String clientId = request.getClientId();
        if (clientId != null && clientId.length() > 128) {
            clientId = clientId.substring(0, 128);
        }

        // Save message
        ChatMessage.ChatMessageBuilder messageBuilder = ChatMessage.builder()
                .chatId(chat.getId())
                .senderId(sender.getId())
                .clientId(clientId)
                .type(messageType)
                .status(ChatMessage.MessageStatus.SENT)
                .mediaKey(request.getMediaKey())
                .viewOnce(request.isViewOnce())
                .expiresAt(expiresAt);

        if (chat.isSupport()) {
            messageBuilder.content(request.getContent());
        } else {
            // Keep top-level fields populated for legacy single-device clients that
            // send only the old fields (no deviceCiphertexts map).
            messageBuilder.ciphertext(request.getCiphertext())
                    .ephemeralKey(request.getEphemeralKey())
                    .preKeyId(request.getPreKeyId())
                    .senderIdentityPublicKey(request.getSenderIdentityPublicKey());
        }

        ChatMessage message = messageBuilder.build();

        message = chatMessageRepository.save(message);

        // Persist multi-device envelopes when provided.
        if (!chat.isSupport()
                && request.getDeviceCiphertexts() != null
                && !request.getDeviceCiphertexts().isEmpty()) {
            final UUID messageId = message.getId();
            List<MessageCiphertext> rows = request.getDeviceCiphertexts().entrySet().stream()
                    .map(entry -> MessageCiphertext.builder()
                            .messageId(messageId)
                            .deviceId(entry.getKey())
                            .ciphertext(entry.getValue().getCiphertext())
                            .ephemeralKey(entry.getValue().getEphemeralKey())
                            .preKeyId(entry.getValue().getPreKeyId())
                            .senderIdentityPublicKey(entry.getValue().getSenderIdentityPublicKey())
                            .build())
                    .toList();
            messageCiphertextRepository.saveAll(rows);
        }

        // Update chat's lastMessageAt
        chat.setLastMessageAt(LocalDateTime.now());
        chatRepository.save(chat);

        // Build the wire payload straight from the request's in-memory envelopes —
        // no read-back of the rows we just saved.
        MessageResponse response = buildMessageResponse(message, sender.getId(), request.getDeviceCiphertexts());

        // Defer real-time delivery + notification until the transaction commits:
        // we never push a message that could roll back, and the network I/O (Redis
        // fan-out, FCM submit) no longer holds the DB transaction open. The
        // notification stays best-effort — a saturated async executor drops it
        // rather than failing an already-delivered send.
        final UUID p1 = chat.getParticipantOneId();
        final UUID p2 = chat.getParticipantTwoId();
        final UUID chatId = chat.getId();
        final String senderName = sender.getFirstName() + " " + sender.getLastName();
        final String senderAvatar = sender.getProfileImageUrl();
        final UUID senderId = sender.getId();
        runAfterCommit(() -> {
            webSocketPublisher.publishToChatRoom(p1, p2, WebSocketEventType.CHAT_MESSAGE, response);
            try {
                notificationService.sendNewMessageNotification(
                        recipientId, senderName, senderId, chatId.toString(), senderAvatar);
            } catch (RejectedExecutionException e) {
                log.warn("New-message notification dropped (executor saturated) for chat {}", chatId);
            }
        });

        log.debug("Message sent in chat {} by user {} (server compute {} us)",
                chat.getId(), sender.getId(), (System.nanoTime() - startNanos) / 1000);
        return response;
    }

    // ==================== GET MESSAGES ====================

    public Page<MessageResponse> getMessages(User user, UUID chatId, int page, int size) {
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new AppException("Chat not found"));

        assertParticipant(chat, user.getId());

        int cappedSize = Math.min(size, 50);
        Page<ChatMessage> pageData = chatMessageRepository.findByChatId(chatId, PageRequest.of(page, cappedSize));

        // Batch-load the multi-device envelopes for the whole page in one query
        // and group by message id, instead of issuing a findByMessageId per row.
        List<UUID> messageIds = pageData.getContent().stream().map(ChatMessage::getId).toList();
        Map<UUID, List<MessageCiphertext>> ciphertextsByMessage = new HashMap<>();
        if (!messageIds.isEmpty()) {
            for (MessageCiphertext row : messageCiphertextRepository.findByMessageIdIn(messageIds)) {
                ciphertextsByMessage.computeIfAbsent(row.getMessageId(), k -> new ArrayList<>()).add(row);
            }
        }

        return pageData.map(m -> toMessageResponse(m, user.getId(),
                ciphertextsByMessage.getOrDefault(m.getId(), List.of())));
    }

    // ==================== MARK AS READ ====================

    @Transactional
    public void markAsRead(User user, UUID chatId) {
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new AppException("Chat not found"));

        assertParticipant(chat, user.getId());

        int updated = chatMessageRepository.markAsRead(chatId, user.getId());

        if (updated > 0) {
            // Notify the other participant that their messages were read

            Map<String, Object> payload = new HashMap<>();
            payload.put("chatId", chatId.toString());
            payload.put("readBy", user.getId().toString());
            payload.put("readAt", LocalDateTime.now().toString());

            webSocketPublisher.publishToChatRoom(
                    chat.getParticipantOneId(), chat.getParticipantTwoId(),
                    WebSocketEventType.CHAT_READ, payload);
        }
    }

    // ==================== MARK AS DELIVERED ====================

    @Transactional
    public void markAsDelivered(User user, UUID chatId) {
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new AppException("Chat not found"));

        assertParticipant(chat, user.getId());

        int updated = chatMessageRepository.markAsDelivered(chatId, user.getId());

        if (updated > 0) {
            Map<String, Object> payload = new HashMap<>();
            payload.put("chatId", chatId.toString());
            payload.put("deliveredTo", user.getId().toString());
            payload.put("deliveredAt", LocalDateTime.now().toString());

            webSocketPublisher.publishToChatRoom(
                    chat.getParticipantOneId(), chat.getParticipantTwoId(),
                    WebSocketEventType.CHAT_DELIVERED, payload);
        }
    }

    // ==================== TYPING INDICATOR ====================

    /** Notify the other participant that the caller took a screenshot (only meaningful when disappearing messages are on). */
    public void notifyScreenshot(User user, UUID chatId) {
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new AppException("Chat not found"));
        assertParticipant(chat, user.getId());

        Map<String, Object> payload = new HashMap<>();
        payload.put("chatId", chatId.toString());
        payload.put("senderName", user.getFirstName() != null
                ? user.getFirstName()
                : (user.getUsername() != null ? "@" + user.getUsername() : "Someone"));

        UUID recipientId = getOtherParticipantId(chat, user.getId());
        webSocketPublisher.publishToChatRoom(
                chat.getParticipantOneId(), chat.getParticipantTwoId(),
                WebSocketEventType.CHAT_SCREENSHOT, payload);

        log.info("Screenshot notification sent in chat {} by {}", chatId, user.getId());
    }

    public void sendTypingIndicator(User user, TypingRequest request) {
        Chat chat = chatRepository.findById(request.getChatId())
                .orElseThrow(() -> new AppException("Chat not found"));

        assertParticipant(chat, user.getId());

        Map<String, Object> payload = new HashMap<>();
        payload.put("chatId", request.getChatId().toString());
        payload.put("userId", user.getId().toString());
        payload.put("isTyping", request.isTyping());

        webSocketPublisher.publishToChatRoom(
                chat.getParticipantOneId(), chat.getParticipantTwoId(),
                WebSocketEventType.CHAT_TYPING, payload);
    }

    // ==================== DELETE MESSAGE ====================

    @Transactional
    public void deleteMessage(User user, UUID messageId) {
        ChatMessage message = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new AppException("Message not found"));

        if (!message.getSenderId().equals(user.getId())) {
            throw new AppException("Not authorized to delete this message");
        }

        message.setIsDeleted(true);
        message.setCiphertext("[deleted]");
        message.setEphemeralKey(null);
        message.setPreKeyId(null);
        message.setSenderIdentityPublicKey(null);
        message.setMediaKey(null);
        chatMessageRepository.save(message);
    }

    // ==================== MUTE / ARCHIVE ====================

    @Transactional
    public void muteChat(User user, UUID chatId, boolean mute) {
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new AppException("Chat not found"));

        assertParticipant(chat, user.getId());

        if (user.getId().equals(chat.getParticipantOneId())) {
            chat.setIsMutedByOne(mute);
        } else {
            chat.setIsMutedByTwo(mute);
        }
        chatRepository.save(chat);
    }

    @Transactional
    public void archiveChat(User user, UUID chatId, boolean archive) {
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new AppException("Chat not found"));

        assertParticipant(chat, user.getId());

        if (user.getId().equals(chat.getParticipantOneId())) {
            chat.setIsArchivedByOne(archive);
        } else {
            chat.setIsArchivedByTwo(archive);
        }
        chatRepository.save(chat);
    }

    // ==================== SUPPORT CHAT ====================

    @Transactional
    public ChatResponse getOrCreateSupportChat(User user, String supportHandle) {
        User supportUser = userRepository.findByUsername(supportHandle)
                .orElseThrow(() -> new AppException("Support account not found"));

        Chat chat = chatRepository.findByParticipants(user.getId(), supportUser.getId())
                .orElseGet(() -> {
                    Chat newChat = Chat.builder()
                            .participantOneId(user.getId())
                            .participantTwoId(supportUser.getId())
                            .isSupport(true)
                            .build();
                    return chatRepository.save(newChat);
                });

        return toChatResponse(chat, user.getId());
    }

    public Page<ChatResponse> listAllSupportChats(int page, int size) {
        return chatRepository.findAllSupportChats(PageRequest.of(page, size))
                .map(chat -> toChatResponse(chat, chat.getParticipantTwoId())); // Participant Two is typically the support account
    }

    @Transactional
    public MessageResponse sendSupportMessage(User user, UUID chatId, String content) {
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new AppException("Chat not found"));
        if (!chat.isSupport()) {
            throw new AppException("This is not a support chat");
        }

        SendMessageRequest request = new SendMessageRequest();
        request.setChatId(chatId);
        request.setContent(content);
        request.setType("TEXT");

        return sendMessage(user, chat, request);
    }

    // ==================== UNREAD COUNT ====================

    public long getTotalUnreadCount(UUID userId) {
        return chatMessageRepository.countTotalUnread(userId);
    }

    // ==================== DISAPPEARING MESSAGES ====================

    @Transactional
    public void setDisappearingMessages(User user, UUID chatId, Integer ttlSeconds) {
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new AppException("Chat not found"));
        assertParticipant(chat, user.getId());

        chat.setDisappearingMessagesTtl(ttlSeconds == 0 ? null : ttlSeconds);
        chatRepository.save(chat);

        Map<String, Object> payload = new HashMap<>();
        payload.put("chatId", chatId.toString());
        payload.put("ttlSeconds", ttlSeconds);
        payload.put("updatedBy", user.getId().toString());

        webSocketPublisher.publishToChatRoom(
                chat.getParticipantOneId(), chat.getParticipantTwoId(),
                WebSocketEventType.CHAT_DISAPPEARING_UPDATED, payload);

        log.info("Disappearing messages set to {}s in chat {} by {}",
                ttlSeconds, chatId, user.getId());
    }

    /** Scheduled job — runs every minute, wipes content of expired messages. */
    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void purgeExpiredMessages() {
        List<ChatMessage> expired = chatMessageRepository.findExpiredMessages(LocalDateTime.now());
        for (ChatMessage msg : expired) {
            msg.setIsDeleted(true);
            msg.setCiphertext("[expired]");
            msg.setEphemeralKey(null);
            msg.setPreKeyId(null);
            msg.setSenderIdentityPublicKey(null);
            msg.setMediaKey(null);
            chatMessageRepository.save(msg);

            chatRepository.findById(msg.getChatId()).ifPresent(chat -> {
                Map<String, Object> payload = new HashMap<>();
                payload.put("messageId", msg.getId().toString());
                payload.put("chatId", msg.getChatId().toString());
                payload.put("reason", "expired");
                webSocketPublisher.publishToChatRoom(
                        chat.getParticipantOneId(), chat.getParticipantTwoId(),
                        WebSocketEventType.CHAT_MESSAGE_DELETED, payload);
            });
        }
        if (!expired.isEmpty()) {
            log.info("Purged {} expired disappearing message(s)", expired.size());
        }
    }

    // ==================== VIEW-ONCE MEDIA ====================

    @Transactional
    public MessageResponse markMediaViewed(User viewer, UUID messageId) {
        ChatMessage message = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new AppException("Message not found"));

        if (!Boolean.TRUE.equals(message.getViewOnce())) {
            throw new AppException("This message is not a view-once message");
        }
        if (message.getSenderId().equals(viewer.getId())) {
            throw new AppException("Sender cannot consume their own view-once message");
        }
        if (message.getViewedAt() != null) {
            throw new AppException("This media has already been viewed");
        }

        // Verify the viewer is a participant of the chat
        Chat chat = chatRepository.findById(message.getChatId())
                .orElseThrow(() -> new AppException("Chat not found"));
        assertParticipant(chat, viewer.getId());

        message.setViewedAt(LocalDateTime.now());
        message.setMediaKey(null); // wipe the URL — media is consumed
        chatMessageRepository.save(message);

        MessageResponse response = toMessageResponse(message, viewer.getId());

        Map<String, Object> payload = new HashMap<>();
        payload.put("messageId", messageId.toString());
        payload.put("chatId", message.getChatId().toString());
        payload.put("viewedAt", message.getViewedAt().toString());
        webSocketPublisher.publishToChatRoom(
                chat.getParticipantOneId(), chat.getParticipantTwoId(),
                WebSocketEventType.CHAT_MEDIA_VIEWED, payload);

        log.debug("View-once message {} consumed by {}", messageId, viewer.getId());
        return response;
    }

    // ==================== MESSAGE EDITING ====================

    @Transactional
    public MessageResponse editMessage(User editor, UUID messageId, String newCiphertext) {
        ChatMessage message = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new AppException("Message not found"));

        if (!message.getSenderId().equals(editor.getId())) {
            throw new AppException("You can only edit your own messages");
        }
        if (Boolean.TRUE.equals(message.getIsDeleted())) {
            throw new AppException("Cannot edit a deleted message");
        }
        if (message.getType() != ChatMessage.MessageType.TEXT) {
            throw new AppException("Only text messages can be edited");
        }
        if (message.getSentAt() != null &&
                message.getSentAt().isBefore(
                        LocalDateTime.now().minusMinutes(MESSAGE_EDIT_WINDOW_MINUTES))) {
            throw new AppException(
                    "Messages can only be edited within " + MESSAGE_EDIT_WINDOW_MINUTES + " minutes of sending");
        }

        message.setCiphertext(newCiphertext);
        message.setEditedAt(LocalDateTime.now());
        chatMessageRepository.save(message);

        MessageResponse response = toMessageResponse(message, editor.getId());

        Chat chat = chatRepository.findById(message.getChatId())
                .orElseThrow(() -> new AppException("Chat not found"));
        webSocketPublisher.publishToChatRoom(
                chat.getParticipantOneId(), chat.getParticipantTwoId(),
                WebSocketEventType.CHAT_MESSAGE_EDITED, response);

        log.debug("Message {} edited by {}", messageId, editor.getId());
        return response;
    }

    // ==================== MEDIA UPLOAD ====================

    public ChatMediaResponse uploadChatMedia(User user, MultipartFile file, UUID chatId, String type, boolean encrypted) {
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new AppException("Chat not found"));
        assertParticipant(chat, user.getId());

        rateLimitService.enforceRateLimit("chat_media:" + user.getId(), 20, Duration.ofHours(1));

        String url;
        if (encrypted) {
            // E2EE blob: opaque ciphertext, so content-type/magic-byte checks can't
            // apply. Still enforce non-empty + size, and store as a raw resource.
            validateEncryptedMediaFile(file);
            url = cloudinaryService.uploadChatMediaRaw(file, chatId.toString());
        } else {
            validateMediaFile(file);
            url = cloudinaryService.uploadChatMedia(file, chatId.toString());
        }
        log.info("Chat media uploaded by user {} to chat {}: type={} encrypted={}",
                user.getId(), chatId, type, encrypted);
        return new ChatMediaResponse(url, type.toUpperCase(), chatId.toString());
    }

    // ==================== HELPERS ====================

    private void assertParticipant(Chat chat, UUID userId) {
        if (!chat.getParticipantOneId().equals(userId) &&
                !chat.getParticipantTwoId().equals(userId)) {
            throw new AppException("Not authorized to access this chat");
        }
    }

    private UUID getOtherParticipantId(Chat chat, UUID userId) {
        return chat.getParticipantOneId().equals(userId)
                ? chat.getParticipantTwoId()
                : chat.getParticipantOneId();
    }

    private ChatResponse toChatResponse(Chat chat, UUID currentUserId) {
        UUID otherUserId = getOtherParticipantId(chat, currentUserId);
        User otherUser = userRepository.findById(otherUserId).orElse(null);

        boolean isMuted = currentUserId.equals(chat.getParticipantOneId())
                ? Boolean.TRUE.equals(chat.getIsMutedByOne())
                : Boolean.TRUE.equals(chat.getIsMutedByTwo());

        boolean isArchived = currentUserId.equals(chat.getParticipantOneId())
                ? Boolean.TRUE.equals(chat.getIsArchivedByOne())
                : Boolean.TRUE.equals(chat.getIsArchivedByTwo());

        long unreadCount = chatMessageRepository
                .findUnreadMessages(chat.getId(), currentUserId).size();

        // Presence as the current user is allowed to see it (privacy toggle + blocks).
        com.aza.backend.dto.user.PresenceResponse otherPresence = otherUser != null
                ? presenceService.getPresenceFor(currentUserId, otherUser)
                : null;

        return ChatResponse.builder()
                .id(chat.getId().toString())
                .otherUserId(otherUserId.toString())
                .otherUserName(otherUser != null
                        ? otherUser.getFirstName() + " " + otherUser.getLastName() : "Unknown")
                .otherUserHandle(otherUser != null ? otherUser.getUsername() : null)
                .otherUserAvatar(otherUser != null ? otherUser.getProfileImageUrl() : null)
                .otherUserStatus(otherPresence != null ? otherPresence.getStatus() : "OFFLINE")
                .otherUserLastSeenAt(otherPresence != null
                        ? com.aza.backend.util.TimeFormats.toUtcIso(otherPresence.getLastSeenAt()) : null)
                .lastMessageAt(com.aza.backend.util.TimeFormats.toUtcIso(chat.getLastMessageAt()))
                .unreadCount(unreadCount)
                .isMuted(isMuted)
                .isArchived(isArchived)
                .build();
    }

    /**
     * Validation for an already-encrypted (opaque) media blob. Content type and
     * magic bytes are meaningless for ciphertext, so only non-empty + size apply.
     */
    private void validateEncryptedMediaFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new AppException("File is required");
        }
        if (file.getSize() > MAX_MEDIA_SIZE) {
            throw new AppException("File exceeds the 25 MB limit");
        }
    }

    private void validateMediaFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new AppException("File is required");
        }
        if (file.getSize() > MAX_MEDIA_SIZE) {
            throw new AppException("File exceeds the 25 MB limit");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_MEDIA_TYPES.contains(contentType)) {
            throw new AppException("Unsupported file type. Allowed: JPEG, PNG, GIF, MP4, MP3, AAC, audio/mp4, PDF");
        }
        // Skip magic-byte check for types where it is unreliable
        if (MAGIC_BYTES_FALLBACK.contains(contentType)) return;

        try {
            byte[] bytes = file.getBytes();
            if (!isValidMagicBytes(bytes, contentType)) {
                throw new AppException("File content does not match its declared type");
            }
        } catch (IOException e) {
            throw new AppException("Failed to read uploaded file");
        }
    }

    private boolean isValidMagicBytes(byte[] b, String contentType) {
        if (b.length < 4) return false;
        return switch (contentType) {
            case "image/jpeg" ->
                    (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF;
            case "image/png" ->
                    (b[0] & 0xFF) == 0x89 && (b[1] & 0xFF) == 0x50
                    && (b[2] & 0xFF) == 0x4E && (b[3] & 0xFF) == 0x47;
            case "image/gif" ->
                    // GIF87a or GIF89a — the first 3 bytes are "GIF"
                    (b[0] & 0xFF) == 0x47 && (b[1] & 0xFF) == 0x49 && (b[2] & 0xFF) == 0x46;
            case "application/pdf" ->
                    (b[0] & 0xFF) == 0x25 && (b[1] & 0xFF) == 0x50
                    && (b[2] & 0xFF) == 0x44 && (b[3] & 0xFF) == 0x46;
            case "video/mp4", "audio/mp4" ->
                    // ISO base media file: 'ftp' box starts at byte 4
                    b.length >= 8
                    && (b[4] & 0xFF) == 0x66 && (b[5] & 0xFF) == 0x74
                    && (b[6] & 0xFF) == 0x79 && (b[7] & 0xFF) == 0x70;
            case "audio/mpeg" ->
                    // ID3 tag header or raw MPEG sync word (FF FB / FF FA / FF F3 / FF F2)
                    ((b[0] & 0xFF) == 0x49 && (b[1] & 0xFF) == 0x44 && (b[2] & 0xFF) == 0x33)
                    || ((b[0] & 0xFF) == 0xFF && (b[1] & 0xE0) == 0xE0);
            default -> false;
        };
    }

    /**
     * Run {@code action} after the current transaction commits — or immediately
     * if no transaction is active — so we never publish/notify for a message that
     * later rolls back, and keep network I/O out of the DB transaction window.
     */
    private void runAfterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }

    private MessageResponse toMessageResponse(ChatMessage message, UUID currentUserId) {
        // On-demand single-message path: load envelopes from the DB.
        Map<String, DeviceCiphertextDto> dc = Boolean.TRUE.equals(message.getIsDeleted())
                ? null
                : toDeviceCiphertextMap(messageCiphertextRepository.findByMessageId(message.getId()));
        return buildMessageResponse(message, currentUserId, dc);
    }

    /**
     * @param preloadedCiphertexts envelopes for this message when the caller has
     *   already batch-loaded them (history pages); null means none.
     */
    private MessageResponse toMessageResponse(ChatMessage message, UUID currentUserId,
                                              List<MessageCiphertext> preloadedCiphertexts) {
        Map<String, DeviceCiphertextDto> dc = Boolean.TRUE.equals(message.getIsDeleted())
                ? null
                : toDeviceCiphertextMap(preloadedCiphertexts);
        return buildMessageResponse(message, currentUserId, dc);
    }

    private Map<String, DeviceCiphertextDto> toDeviceCiphertextMap(List<MessageCiphertext> rows) {
        if (rows == null || rows.isEmpty()) return null;
        Map<String, DeviceCiphertextDto> map = new HashMap<>();
        for (MessageCiphertext row : rows) {
            map.put(row.getDeviceId(), DeviceCiphertextDto.builder()
                    .ciphertext(row.getCiphertext())
                    .ephemeralKey(row.getEphemeralKey())
                    .preKeyId(row.getPreKeyId())
                    .senderIdentityPublicKey(row.getSenderIdentityPublicKey())
                    .build());
        }
        return map;
    }

    /**
     * Build the wire response from an already-resolved envelope map. The chat
     * send path passes the request's in-memory map straight through, avoiding a
     * read-back of the rows it just wrote. A null/empty map means a legacy
     * message and the client falls back to the top-level ciphertext fields.
     */
    private MessageResponse buildMessageResponse(ChatMessage message, UUID currentUserId,
                                                 Map<String, DeviceCiphertextDto> deviceCiphertexts) {
        if (deviceCiphertexts != null && deviceCiphertexts.isEmpty()) deviceCiphertexts = null;
        if (Boolean.TRUE.equals(message.getIsDeleted())) deviceCiphertexts = null;
        PaymentRequestResponse paymentRequest = null;
        if (message.getType() == ChatMessage.MessageType.PAYMENT_REQUEST
                && message.getPaymentRequestId() != null) {
            paymentRequest = paymentRequestRepository.findById(message.getPaymentRequestId())
                    .map(pr -> PaymentRequestResponse.builder()
                            .id(pr.getId().toString())
                            .chatId(pr.getChatId().toString())
                            .requesterId(pr.getRequesterId().toString())
                            .payerId(pr.getPayerId().toString())
                            .amount(pr.getAmount())
                            .currency(pr.getCurrency())
                            .note(pr.getNote())
                            .status(pr.getStatus().name())
                            .transactionId(pr.getTransactionId() != null
                                    ? pr.getTransactionId().toString() : null)
                            .expiresAt(pr.getExpiresAt() != null ? pr.getExpiresAt().toString() : null)
                            .paidAt(pr.getPaidAt() != null ? pr.getPaidAt().toString() : null)
                            .declinedAt(pr.getDeclinedAt() != null ? pr.getDeclinedAt().toString() : null)
                            .cancelledAt(pr.getCancelledAt() != null ? pr.getCancelledAt().toString() : null)
                            .createdAt(pr.getCreatedAt() != null ? pr.getCreatedAt().toString() : null)
                            .build())
                    .orElse(null);
        }

        return MessageResponse.builder()
                .id(message.getId().toString())
                .chatId(message.getChatId().toString())
                .senderId(message.getSenderId().toString())
                .clientId(message.getClientId())
                .ciphertext(Boolean.TRUE.equals(message.getIsDeleted())
                        ? null : message.getCiphertext())
                .content(message.getContent())
                .ephemeralKey(message.getEphemeralKey())
                .preKeyId(message.getPreKeyId())
                .senderIdentityPublicKey(message.getSenderIdentityPublicKey())
                .type(message.getType().name())
                .status(message.getStatus().name())
                .sentAt(message.getSentAt() != null ? message.getSentAt().toString() : null)
                .deliveredAt(message.getDeliveredAt() != null
                        ? message.getDeliveredAt().toString() : null)
                .readAt(message.getReadAt() != null ? message.getReadAt().toString() : null)
                .isDeleted(Boolean.TRUE.equals(message.getIsDeleted()))
                .mediaKey(message.getMediaKey())
                .viewOnce(Boolean.TRUE.equals(message.getViewOnce()))
                .viewedAt(message.getViewedAt() != null ? message.getViewedAt().toString() : null)
                .editedAt(message.getEditedAt() != null ? message.getEditedAt().toString() : null)
                .expiresAt(message.getExpiresAt() != null ? message.getExpiresAt().toString() : null)
                .isSelf(currentUserId != null ? message.getSenderId().equals(currentUserId) : null)
                .paymentRequest(paymentRequest)
                .deviceCiphertexts(deviceCiphertexts)
                .build();
    }
}
