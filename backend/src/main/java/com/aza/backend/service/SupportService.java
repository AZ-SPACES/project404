package com.aza.backend.service;

import com.aza.backend.dto.chat.MessageResponse;
import com.aza.backend.dto.websocket.WebSocketEventType;
import com.aza.backend.entity.Chat;
import com.aza.backend.entity.ChatMessage;
import com.aza.backend.entity.User;
import com.aza.backend.exception.AppException;
import com.aza.backend.repository.ChatMessageRepository;
import com.aza.backend.repository.ChatRepository;
import com.aza.backend.repository.UserRepository;
import com.aza.backend.util.CloudinaryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import java.util.concurrent.RejectedExecutionException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.web.multipart.MultipartFile;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class SupportService {

    private final UserRepository userRepository;
    private final ChatRepository chatRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final WebSocketPublisher webSocketPublisher;
    private final NotificationService notificationService;
    private final PresenceService presenceService;
    private final CloudinaryService cloudinaryService;
    private final SupportBotProcessor botProcessor;

    // ==================== USER-FACING ====================

    /** Overload kept for backward-compat — delegates with no category. */
    @Transactional
    public Chat getOrCreateSupportChat(User user) {
        return getOrCreateSupportChat(user, null);
    }

    @Transactional
    public Chat getOrCreateSupportChat(User user, String category) {
        return chatRepository.findSupportChatByUserId(user.getId())
                .orElseGet(() -> {
                    // Assign to any available admin; the admin dashboard shows all support chats
                    User agent = userRepository.findAllByRole(User.UserRole.ADMIN)
                            .stream().findFirst()
                            .orElseThrow(() -> new AppException(
                                    "SUPPORT_UNAVAILABLE",
                                    "Support is currently unavailable",
                                    HttpStatus.SERVICE_UNAVAILABLE));
                    Chat chat = Chat.builder()
                            .participantOneId(user.getId())
                            .participantTwoId(agent.getId())
                            .isSupport(true)
                            .category(category)
                            .build();
                    return chatRepository.save(chat);
                });
    }

    public Page<MessageResponse> getUserSupportMessages(User user, int page, int size) {
        Chat chat = chatRepository.findSupportChatByUserId(user.getId())
                .orElseThrow(() -> new AppException("CHAT_NOT_FOUND", "No support chat found", HttpStatus.NOT_FOUND));
        return chatMessageRepository.findByChatId(chat.getId(), PageRequest.of(page, Math.min(size, 50)))
                .map(m -> toMessageResponse(m, user.getId()));
    }

    @Transactional
    public MessageResponse sendUserMessage(User user, String content) {
        if (content == null || content.isBlank()) {
            throw new AppException("INVALID_CONTENT", "Message content cannot be empty", HttpStatus.BAD_REQUEST);
        }

        Chat chat = getOrCreateSupportChat(user);

        ChatMessage message = ChatMessage.builder()
                .chatId(chat.getId())
                .senderId(user.getId())
                .content(content.strip())
                .type(ChatMessage.MessageType.TEXT)
                .status(ChatMessage.MessageStatus.SENT)
                .build();

        message = chatMessageRepository.save(message);
        chat.setLastMessageAt(LocalDateTime.now());
        chatRepository.save(chat);

        MessageResponse response = toMessageResponse(message);

        webSocketPublisher.publishToChatRoom(
                chat.getParticipantOneId(), chat.getParticipantTwoId(),
                WebSocketEventType.CHAT_MESSAGE, response);

        webSocketPublisher.publishToAdminSupport(
                WebSocketEventType.SUPPORT_NEW_MESSAGE,
                getSupportChatSummary(chat.getId()));

        if (Boolean.TRUE.equals(chat.getBotActive())) {
            // AI bot handles this chat — generate async response
            botProcessor.generateAndReply(chat.getId(), user.getId());
        } else {
            // Human agent owns the chat — send push notification (async, best-effort)
            try {
                notificationService.sendNewMessageNotification(
                        chat.getParticipantTwoId(),
                        user.getFirstName() + " " + user.getLastName(),
                        user.getId(),
                        chat.getId().toString(),
                        user.getProfileImageUrl());
            } catch (RejectedExecutionException e) {
                log.warn("Support notification dropped (executor saturated) for chat {}", chat.getId());
            }
        }

        return response;
    }

    // ==================== ADMIN-FACING ====================

    public SupportChatSummary getSupportChatSummary(UUID chatId) {
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new AppException("CHAT_NOT_FOUND", "Support chat not found", HttpStatus.NOT_FOUND));

        UUID userId = chat.getParticipantOneId();
        User user = userRepository.findById(userId).orElse(null);
        ChatMessage last = chatMessageRepository
                .findByChatId(chat.getId(), PageRequest.of(0, 1))
                .getContent().stream().findFirst().orElse(null);

        // Count unread messages sent by the user (participantOne) that are still SENT (not READ)
        List<ChatMessage> recentMessages = chatMessageRepository
                .findByChatId(chat.getId(), PageRequest.of(0, 200))
                .getContent();
        int unreadCount = (int) recentMessages.stream()
                .filter(m -> userId.equals(m.getSenderId())
                        && ChatMessage.MessageStatus.SENT.equals(m.getStatus()))
                .count();

        return new SupportChatSummary(
                chat.getId().toString(),
                userId.toString(),
                user != null ? user.getFirstName() + " " + user.getLastName() : "Unknown",
                user != null ? user.getUsername() : null,
                user != null ? user.getProfileImageUrl() : null,
                last != null ? last.getContent() : null,
                chat.getLastMessageAt() != null ? chat.getLastMessageAt().toString() : null,
                chat.getStatus() != null ? chat.getStatus().name() : Chat.ChatStatus.OPEN.name(),
                chat.getPriority() != null ? chat.getPriority().name() : Chat.Priority.NORMAL.name(),
                chat.getCategory(),
                unreadCount,
                Boolean.TRUE.equals(chat.getBotActive()),
                chat.getActiveAgentId() != null ? chat.getActiveAgentId().toString() : null
        );
    }

    public Page<SupportChatSummary> listAllSupportChats(int page, int size) {
        return listAllSupportChats(page, size, null);
    }

    public Page<SupportChatSummary> listAllSupportChats(int page, int size, String status) {
        Page<Chat> chats;
        if (status != null && !status.isBlank()) {
            Chat.ChatStatus chatStatus = Chat.ChatStatus.valueOf(status.toUpperCase());
            chats = chatRepository.findAllSupportChatsByStatus(
                    chatStatus,
                    PageRequest.of(page, size, Sort.by("lastMessageAt").descending()));
        } else {
            chats = chatRepository.findAllSupportChats(
                    PageRequest.of(page, size, Sort.by("lastMessageAt").descending()));
        }
        return chats.map(chat -> {
            UUID userId = chat.getParticipantOneId();
            User user = userRepository.findById(userId).orElse(null);
            ChatMessage last = chatMessageRepository
                    .findByChatId(chat.getId(), PageRequest.of(0, 1))
                    .getContent().stream().findFirst().orElse(null);

            List<ChatMessage> recentMessages = chatMessageRepository
                    .findByChatId(chat.getId(), PageRequest.of(0, 200))
                    .getContent();
            int unreadCount = (int) recentMessages.stream()
                    .filter(m -> userId.equals(m.getSenderId())
                            && ChatMessage.MessageStatus.SENT.equals(m.getStatus()))
                    .count();

            return new SupportChatSummary(
                    chat.getId().toString(),
                    userId.toString(),
                    user != null ? user.getFirstName() + " " + user.getLastName() : "Unknown",
                    user != null ? user.getUsername() : null,
                    user != null ? user.getProfileImageUrl() : null,
                    last != null ? last.getContent() : null,
                    chat.getLastMessageAt() != null ? chat.getLastMessageAt().toString() : null,
                    chat.getStatus() != null ? chat.getStatus().name() : Chat.ChatStatus.OPEN.name(),
                    chat.getPriority() != null ? chat.getPriority().name() : Chat.Priority.NORMAL.name(),
                    chat.getCategory(),
                    unreadCount,
                    Boolean.TRUE.equals(chat.getBotActive()),
                    chat.getActiveAgentId() != null ? chat.getActiveAgentId().toString() : null
            );
        });
    }

    public Page<MessageResponse> getChatMessages(UUID chatId, UUID currentUserId, int page, int size) {
        return chatMessageRepository.findByChatId(chatId, PageRequest.of(page, Math.min(size, 50)))
                .map(m -> toMessageResponse(m, currentUserId));
    }

    @Transactional
    public MessageResponse replyToChat(User agent, UUID chatId, String content) {
        if (content == null || content.isBlank()) {
            throw new AppException("INVALID_CONTENT", "Reply content cannot be empty", HttpStatus.BAD_REQUEST);
        }

        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new AppException("CHAT_NOT_FOUND", "Support chat not found", HttpStatus.NOT_FOUND));

        if (!chat.isSupport()) {
            throw new AppException("NOT_SUPPORT_CHAT", "This is not a support chat", HttpStatus.BAD_REQUEST);
        }

        ChatMessage message = ChatMessage.builder()
                .chatId(chat.getId())
                .senderId(agent.getId())
                .content(content.strip())
                .type(ChatMessage.MessageType.TEXT)
                .status(ChatMessage.MessageStatus.SENT)
                .isAdminReply(true)
                .build();

        message = chatMessageRepository.save(message);
        chat.setLastMessageAt(LocalDateTime.now());
        chatRepository.save(chat);

        MessageResponse agentResponse = toMessageResponse(message, agent.getId());
        // For broadcast, send without isSelf so each subscriber sees their own perspective
        MessageResponse broadcastResponse = toMessageResponse(message);

        notificationService.sendSupportMessageNotification(
                chat.getParticipantOneId(),
                "AZA Support");

        webSocketPublisher.publishToChatRoom(
                chat.getParticipantOneId(), chat.getParticipantTwoId(),
                WebSocketEventType.CHAT_MESSAGE, broadcastResponse);

        // Update inbox on all admin dashboards so they see the latest reply and timestamp
        webSocketPublisher.publishToAdminSupport(
                WebSocketEventType.SUPPORT_CHAT_UPDATED,
                getSupportChatSummary(chatId));

        log.debug("Admin {} replied to support chat {}", agent.getId(), chatId);
        return agentResponse;
    }

    @Transactional
    public SupportChatSummary resolveChat(UUID chatId, User agent) {
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new AppException("CHAT_NOT_FOUND", "Support chat not found", HttpStatus.NOT_FOUND));
        if (!chat.isSupport()) {
            throw new AppException("NOT_SUPPORT_CHAT", "Not a support chat", HttpStatus.BAD_REQUEST);
        }
        chat.setStatus(Chat.ChatStatus.RESOLVED);
        chat.setResolvedAt(LocalDateTime.now());
        chat.setResolvedByName(agent.getFirstName() + " " + agent.getLastName());
        chatRepository.save(chat);
        return getSupportChatSummary(chatId);
    }

    @Transactional
    public SupportChatSummary takeoverChat(UUID chatId, User agent) {
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new AppException("CHAT_NOT_FOUND", "Support chat not found", HttpStatus.NOT_FOUND));
        chat.setBotActive(false);
        chat.setActiveAgentId(agent.getId());
        chat.setHandedOverAt(LocalDateTime.now());
        if (chat.getStatus() == Chat.ChatStatus.PENDING) {
            chat.setStatus(Chat.ChatStatus.OPEN);
        }
        chatRepository.save(chat);

        // Send handoff message to user via WebSocket
        webSocketPublisher.publishToChatRoom(
                chat.getParticipantOneId(), chat.getParticipantTwoId(),
                WebSocketEventType.SUPPORT_HANDOFF,
                Map.of(
                        "chatId", chatId.toString(),
                        "agentName", agent.getFirstName() + " " + agent.getLastName(),
                        "message", "You've been connected with " + agent.getFirstName() + ", a member of the AZA support team."
                ));

        webSocketPublisher.publishToAdminSupport(
                WebSocketEventType.SUPPORT_CHAT_UPDATED,
                getSupportChatSummary(chatId));

        return getSupportChatSummary(chatId);
    }

    @Transactional
    public SupportChatSummary enableBot(UUID chatId) {
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new AppException("CHAT_NOT_FOUND", "Support chat not found", HttpStatus.NOT_FOUND));
        chat.setBotActive(true);
        chat.setActiveAgentId(null);
        chat.setHandedOverAt(null);
        chatRepository.save(chat);
        webSocketPublisher.publishToAdminSupport(
                WebSocketEventType.SUPPORT_CHAT_UPDATED,
                getSupportChatSummary(chatId));
        return getSupportChatSummary(chatId);
    }

    @Transactional
    public SupportChatSummary reopenChat(UUID chatId) {
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new AppException("CHAT_NOT_FOUND", "Support chat not found", HttpStatus.NOT_FOUND));
        chat.setStatus(Chat.ChatStatus.OPEN);
        chat.setResolvedAt(null);
        chat.setResolvedByName(null);
        chatRepository.save(chat);
        return getSupportChatSummary(chatId);
    }

    @Transactional
    public SupportChatSummary updatePriority(UUID chatId, String priority) {
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new AppException("CHAT_NOT_FOUND", "Not found", HttpStatus.NOT_FOUND));
        chat.setPriority(Chat.Priority.valueOf(priority.toUpperCase()));
        chatRepository.save(chat);
        return getSupportChatSummary(chatId);
    }

    @Transactional
    public SupportChatSummary updateCategory(UUID chatId, String category) {
        Chat chat = chatRepository.findById(chatId)
                .orElseThrow(() -> new AppException("CHAT_NOT_FOUND", "Not found", HttpStatus.NOT_FOUND));
        chat.setCategory(category);
        chatRepository.save(chat);
        return getSupportChatSummary(chatId);
    }

    public Map<String, Long> getSupportStats() {
        return Map.of(
                "open", chatRepository.countByIsSupportTrueAndStatus(Chat.ChatStatus.OPEN),
                "resolved", chatRepository.countByIsSupportTrueAndStatus(Chat.ChatStatus.RESOLVED)
        );
    }

    public List<AgentStatus> getAvailableAgents() {
        return userRepository.findAllByRole(User.UserRole.ADMIN).stream()
                .filter(u -> "ONLINE".equals(presenceService.getStatus(u.getId())))
                .map(u -> new AgentStatus(
                        u.getId().toString(),
                        u.getFirstName() + " " + u.getLastName(),
                        u.getProfileImageUrl()))
                .toList();
    }

    @Transactional
    public MessageResponse sendUserMediaMessage(User user, MultipartFile file, String caption) {
        Chat chat = getOrCreateSupportChat(user);

        String mediaUrl = cloudinaryService.uploadChatMedia(file, chat.getId().toString());
        ChatMessage.MessageType type = resolveMediaType(file.getContentType());

        ChatMessage message = ChatMessage.builder()
                .chatId(chat.getId())
                .senderId(user.getId())
                .content(caption != null && !caption.isBlank() ? caption.strip() : null)
                .mediaKey(mediaUrl)
                .type(type)
                .status(ChatMessage.MessageStatus.SENT)
                .build();

        message = chatMessageRepository.save(message);
        chat.setLastMessageAt(LocalDateTime.now());
        chatRepository.save(chat);

        MessageResponse response = toMessageResponse(message, user.getId());

        webSocketPublisher.publishToChatRoom(
                chat.getParticipantOneId(), chat.getParticipantTwoId(),
                WebSocketEventType.CHAT_MESSAGE, toMessageResponse(message));

        webSocketPublisher.publishToAdminSupport(
                WebSocketEventType.SUPPORT_NEW_MESSAGE,
                getSupportChatSummary(chat.getId()));

        if (Boolean.TRUE.equals(chat.getBotActive())) {
            botProcessor.generateAndReply(chat.getId(), user.getId());
        } else {
            try {
                notificationService.sendNewMessageNotification(
                        chat.getParticipantTwoId(),
                        user.getFirstName() + " " + user.getLastName(),
                        user.getId(),
                        chat.getId().toString(),
                        user.getProfileImageUrl());
            } catch (RejectedExecutionException e) {
                log.warn("Support notification dropped (executor saturated) for chat {}", chat.getId());
            }
        }

        return response;
    }

    private ChatMessage.MessageType resolveMediaType(String contentType) {
        if (contentType == null) return ChatMessage.MessageType.DOCUMENT;
        if (contentType.startsWith("image/")) return ChatMessage.MessageType.IMAGE;
        if (contentType.startsWith("video/")) return ChatMessage.MessageType.VIDEO;
        if (contentType.startsWith("audio/")) return ChatMessage.MessageType.VOICE_NOTE;
        return ChatMessage.MessageType.DOCUMENT;
    }

    // ==================== DTOs ====================

    private MessageResponse toMessageResponse(ChatMessage message) {
        return toMessageResponse(message, null);
    }

    private MessageResponse toMessageResponse(ChatMessage message, UUID currentUserId) {
        boolean deleted = Boolean.TRUE.equals(message.getIsDeleted());
        return MessageResponse.builder()
                .id(message.getId().toString())
                .chatId(message.getChatId().toString())
                .senderId(message.getSenderId().toString())
                .content(deleted ? null : message.getContent())
                .type(message.getType().name())
                .status(message.getStatus().name())
                .sentAt(message.getSentAt() != null ? message.getSentAt().toString() : null)
                .deliveredAt(message.getDeliveredAt() != null ? message.getDeliveredAt().toString() : null)
                .readAt(message.getReadAt() != null ? message.getReadAt().toString() : null)
                .isDeleted(deleted)
                .isSelf(currentUserId != null ? message.getSenderId().equals(currentUserId) : null)
                .mediaKey(message.getMediaKey())
                .isBot(message.getIsBot())
                .isAdminReply(message.getIsAdminReply())
                .build();
    }

    public record SupportChatSummary(
            String chatId,
            String userId,
            String userName,
            String userHandle,
            String userAvatar,
            String lastMessage,
            String lastMessageAt,
            String status,
            String priority,
            String category,
            int unreadCount,
            boolean botActive,
            String activeAgentId
    ) {}

    public record AgentStatus(
            String userId,
            String name,
            String avatarUrl
    ) {}
}
