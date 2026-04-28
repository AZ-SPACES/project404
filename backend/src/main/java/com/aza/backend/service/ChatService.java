package com.aza.backend.service;

import com.aza.backend.dto.chat.*;
import com.aza.backend.dto.websocket.WebSocketEventType;
import com.aza.backend.entity.Chat;
import com.aza.backend.entity.ChatMessage;
import com.aza.backend.entity.User;
import com.aza.backend.repository.ChatMessageRepository;
import com.aza.backend.repository.ChatRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.util.CloudinaryService;
import com.aza.backend.util.RateLimitService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatService {

    private final ChatRepository chatRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final UserRepository userRepository;
    private final WebSocketPublisher webSocketPublisher;
    private final PresenceService presenceService;
    private final NotificationService notificationService;
    private final CloudinaryService cloudinaryService;
    private final RateLimitService rateLimitService;

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
            throw new RuntimeException("Cannot create a chat with yourself");
        }

        userRepository.findById(otherUserId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // Find existing chat or create a new one
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
                .orElseThrow(() -> new RuntimeException("Chat not found"));

        assertParticipant(chat, user.getId());
        return toChatResponse(chat, user.getId());
    }

    // ==================== SEND MESSAGE ====================

    @Transactional
    public MessageResponse sendMessage(User sender, SendMessageRequest request) {
        Chat chat = chatRepository.findById(request.getChatId())
                .orElseThrow(() -> new RuntimeException("Chat not found"));

        assertParticipant(chat, sender.getId());

        // Validate message type
        ChatMessage.MessageType messageType;
        try {
            messageType = ChatMessage.MessageType.valueOf(request.getType().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Invalid message type: " + request.getType());
        }

        // Save message
        ChatMessage message = ChatMessage.builder()
                .chatId(chat.getId())
                .senderId(sender.getId())
                .ciphertext(request.getCiphertext())
                .ephemeralKey(request.getEphemeralKey())
                .preKeyId(request.getPreKeyId())
                .type(messageType)
                .status(ChatMessage.MessageStatus.SENT)
                .mediaKey(request.getMediaKey())
                .build();

        message = chatMessageRepository.save(message);

        // Update chat's lastMessageAt
        chat.setLastMessageAt(LocalDateTime.now());
        chatRepository.save(chat);

        MessageResponse response = toMessageResponse(message);

        // Notify recipient if they're not the sender
        UUID recipientId = getOtherParticipantId(chat, sender.getId());
        notificationService.sendNewMessageNotification(
                recipientId,
                sender.getFirstName() + " " + sender.getLastName(),
                chat.getId().toString());

        // Publish to the chat room via Redis Pub/Sub
        // Both participants receive this in real time
        webSocketPublisher.publishToChatRoom(
                chat.getId().toString(),
                WebSocketEventType.CHAT_MESSAGE,
                response);

        log.debug("Message sent in chat {} by user {}", chat.getId(), sender.getId());
        return response;
    }

    // ==================== GET MESSAGES ====================

    public Page<MessageResponse> getMessages(User user, UUID chatId, int page, int size) {
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new RuntimeException("Chat not found"));

        assertParticipant(chat, user.getId());

        int cappedSize = Math.min(size, 50);
        return chatMessageRepository.findByChatId(chatId, PageRequest.of(page, cappedSize))
                .map(this::toMessageResponse);
    }

    // ==================== MARK AS READ ====================

    @Transactional
    public void markAsRead(User user, UUID chatId) {
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new RuntimeException("Chat not found"));

        assertParticipant(chat, user.getId());

        int updated = chatMessageRepository.markAsRead(chatId, user.getId());

        if (updated > 0) {
            // Notify the other participant that their messages were read
            UUID otherUserId = getOtherParticipantId(chat, user.getId());

            Map<String, Object> payload = new HashMap<>();
            payload.put("chatId", chatId.toString());
            payload.put("readBy", user.getId().toString());
            payload.put("readAt", LocalDateTime.now().toString());

            webSocketPublisher.publishToChatRoom(
                    chatId.toString(),
                    WebSocketEventType.CHAT_READ,
                    payload);
        }
    }

    // ==================== MARK AS DELIVERED ====================

    @Transactional
    public void markAsDelivered(User user, UUID chatId) {
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new RuntimeException("Chat not found"));

        assertParticipant(chat, user.getId());

        int updated = chatMessageRepository.markAsDelivered(chatId, user.getId());

        if (updated > 0) {
            UUID otherUserId = getOtherParticipantId(chat, user.getId());

            Map<String, Object> payload = new HashMap<>();
            payload.put("chatId", chatId.toString());
            payload.put("deliveredTo", user.getId().toString());
            payload.put("deliveredAt", LocalDateTime.now().toString());

            webSocketPublisher.publishToChatRoom(
                    chatId.toString(),
                    WebSocketEventType.CHAT_DELIVERED,
                    payload);
        }
    }

    // ==================== TYPING INDICATOR ====================

    public void sendTypingIndicator(User user, TypingRequest request) {
        Chat chat = chatRepository.findById(request.getChatId())
                .orElseThrow(() -> new RuntimeException("Chat not found"));

        assertParticipant(chat, user.getId());

        Map<String, Object> payload = new HashMap<>();
        payload.put("chatId", request.getChatId().toString());
        payload.put("userId", user.getId().toString());
        payload.put("isTyping", request.isTyping());

        webSocketPublisher.publishToChatRoom(
                request.getChatId().toString(),
                WebSocketEventType.CHAT_TYPING,
                payload);
    }

    // ==================== DELETE MESSAGE ====================

    @Transactional
    public void deleteMessage(User user, UUID messageId) {
        ChatMessage message = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found"));

        if (!message.getSenderId().equals(user.getId())) {
            throw new RuntimeException("Not authorized to delete this message");
        }

        message.setIsDeleted(true);
        message.setCiphertext("[deleted]");
        message.setEphemeralKey(null);
        message.setPreKeyId(null);
        message.setMediaKey(null);
        chatMessageRepository.save(message);
    }

    // ==================== MUTE / ARCHIVE ====================

    @Transactional
    public void muteChat(User user, UUID chatId, boolean mute) {
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new RuntimeException("Chat not found"));

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
                .orElseThrow(() -> new RuntimeException("Chat not found"));

        assertParticipant(chat, user.getId());

        if (user.getId().equals(chat.getParticipantOneId())) {
            chat.setIsArchivedByOne(archive);
        } else {
            chat.setIsArchivedByTwo(archive);
        }
        chatRepository.save(chat);
    }

    // ==================== UNREAD COUNT ====================

    public long getTotalUnreadCount(UUID userId) {
        return chatMessageRepository.countTotalUnread(userId);
    }

    // ==================== MEDIA UPLOAD ====================

    public ChatMediaResponse uploadChatMedia(User user, MultipartFile file, UUID chatId, String type) {
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new RuntimeException("Chat not found"));
        assertParticipant(chat, user.getId());

        rateLimitService.enforceRateLimit("chat_media:" + user.getId(), 20, Duration.ofHours(1));

        validateMediaFile(file);

        String url = cloudinaryService.uploadChatMedia(file, chatId.toString());
        log.info("Chat media uploaded by user {} to chat {}: type={}", user.getId(), chatId, type);
        return new ChatMediaResponse(url, type.toUpperCase(), chatId.toString());
    }

    // ==================== HELPERS ====================

    private void assertParticipant(Chat chat, UUID userId) {
        if (!chat.getParticipantOneId().equals(userId) &&
                !chat.getParticipantTwoId().equals(userId)) {
            throw new RuntimeException("Not authorized to access this chat");
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

        return ChatResponse.builder()
                .id(chat.getId().toString())
                .otherUserId(otherUserId.toString())
                .otherUserName(otherUser != null
                        ? otherUser.getFirstName() + " " + otherUser.getLastName() : "Unknown")
                .otherUserHandle(otherUser != null ? otherUser.getHandle() : null)
                .otherUserAvatar(otherUser != null ? otherUser.getProfileImageUrl() : null)
                .otherUserStatus(otherUser != null
                        ? presenceService.getStatus(otherUser.getId()) : "OFFLINE")
                .lastMessageAt(chat.getLastMessageAt() != null
                        ? chat.getLastMessageAt().toString() : null)
                .unreadCount(unreadCount)
                .isMuted(isMuted)
                .isArchived(isArchived)
                .build();
    }

    private void validateMediaFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new RuntimeException("File is required");
        }
        if (file.getSize() > MAX_MEDIA_SIZE) {
            throw new RuntimeException("File exceeds the 25 MB limit");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_MEDIA_TYPES.contains(contentType)) {
            throw new RuntimeException("Unsupported file type. Allowed: JPEG, PNG, GIF, MP4, MP3, AAC, audio/mp4, PDF");
        }
        // Skip magic-byte check for types where it is unreliable
        if (MAGIC_BYTES_FALLBACK.contains(contentType)) return;

        try {
            byte[] bytes = file.getBytes();
            if (!isValidMagicBytes(bytes, contentType)) {
                throw new RuntimeException("File content does not match its declared type");
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to read uploaded file");
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
                    // GIF87a or GIF89a — first 3 bytes are "GIF"
                    (b[0] & 0xFF) == 0x47 && (b[1] & 0xFF) == 0x49 && (b[2] & 0xFF) == 0x46;
            case "application/pdf" ->
                    (b[0] & 0xFF) == 0x25 && (b[1] & 0xFF) == 0x50
                    && (b[2] & 0xFF) == 0x44 && (b[3] & 0xFF) == 0x46;
            case "video/mp4", "audio/mp4" ->
                    // ISO base media file: 'ftyp' box starts at byte 4
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

    private MessageResponse toMessageResponse(ChatMessage message) {
        return MessageResponse.builder()
                .id(message.getId().toString())
                .chatId(message.getChatId().toString())
                .senderId(message.getSenderId().toString())
                .ciphertext(Boolean.TRUE.equals(message.getIsDeleted())
                        ? null : message.getCiphertext())
                .ephemeralKey(message.getEphemeralKey())
                .preKeyId(message.getPreKeyId())
                .type(message.getType().name())
                .status(message.getStatus().name())
                .sentAt(message.getSentAt() != null ? message.getSentAt().toString() : null)
                .deliveredAt(message.getDeliveredAt() != null
                        ? message.getDeliveredAt().toString() : null)
                .readAt(message.getReadAt() != null ? message.getReadAt().toString() : null)
                .isDeleted(Boolean.TRUE.equals(message.getIsDeleted()))
                .mediaKey(message.getMediaKey())
                .build();
    }
}
