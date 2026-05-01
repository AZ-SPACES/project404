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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
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

    // ==================== USER-FACING ====================

    @Transactional
    public Chat getOrCreateSupportChat(User user) {
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

        // Notify the assigned support agent
        notificationService.sendNewMessageNotification(
                chat.getParticipantTwoId(),
                user.getFirstName() + " " + user.getLastName(),
                chat.getId().toString());

        webSocketPublisher.publishToChatRoom(
                chat.getParticipantOneId(), chat.getParticipantTwoId(),
                WebSocketEventType.CHAT_MESSAGE, response);

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

        return new SupportChatSummary(
                chat.getId().toString(),
                userId.toString(),
                user != null ? user.getFirstName() + " " + user.getLastName() : "Unknown",
                user != null ? user.getHandle() : null,
                user != null ? user.getProfileImageUrl() : null,
                last != null ? last.getContent() : null,
                chat.getLastMessageAt() != null ? chat.getLastMessageAt().toString() : null
        );
    }

    public Page<SupportChatSummary> listAllSupportChats(int page, int size) {
        Page<Chat> chats = chatRepository.findAllSupportChats(
                PageRequest.of(page, size, Sort.by("lastMessageAt").descending()));
        return chats.map(chat -> {
            UUID userId = chat.getParticipantOneId();
            User user = userRepository.findById(userId).orElse(null);
            ChatMessage last = chatMessageRepository
                    .findByChatId(chat.getId(), PageRequest.of(0, 1))
                    .getContent().stream().findFirst().orElse(null);
            return new SupportChatSummary(
                    chat.getId().toString(),
                    userId.toString(),
                    user != null ? user.getFirstName() + " " + user.getLastName() : "Unknown",
                    user != null ? user.getHandle() : null,
                    user != null ? user.getProfileImageUrl() : null,
                    last != null ? last.getContent() : null,
                    chat.getLastMessageAt() != null ? chat.getLastMessageAt().toString() : null
            );
        });
    }

    public Page<MessageResponse> getChatMessages(UUID chatId, int page, int size) {
        return chatMessageRepository.findByChatId(chatId, PageRequest.of(page, Math.min(size, 50)))
                .map(this::toMessageResponse);
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
                .build();

        message = chatMessageRepository.save(message);
        chat.setLastMessageAt(LocalDateTime.now());
        chatRepository.save(chat);

        MessageResponse response = toMessageResponse(message);

        notificationService.sendNewMessageNotification(
                chat.getParticipantOneId(),
                "AZA Support",
                chat.getId().toString());

        webSocketPublisher.publishToChatRoom(
                chat.getParticipantOneId(), chat.getParticipantTwoId(),
                WebSocketEventType.CHAT_MESSAGE, response);

        log.debug("Admin {} replied to support chat {}", agent.getId(), chatId);
        return response;
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
                .build();
    }

    public record SupportChatSummary(
            String chatId,
            String userId,
            String userName,
            String userHandle,
            String userAvatar,
            String lastMessage,
            String lastMessageAt
    ) {}

    public record AgentStatus(
            String userId,
            String name,
            String avatarUrl
    ) {}
}
